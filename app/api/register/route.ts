import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { sendAccountantInvite } from '@/lib/mailer';

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function latinize(value:string){
  const map:Record<string,string>={а:'a',б:'b',в:'v',г:'g',д:'d',ђ:'dj',е:'e',ж:'z',з:'z',и:'i',ј:'j',к:'k',л:'l',љ:'lj',м:'m',н:'n',њ:'nj',о:'o',п:'p',р:'r',с:'s',т:'t',ћ:'c',у:'u',ф:'f',х:'h',ц:'c',ч:'c',џ:'dz',ш:'s'};
  return value.toLowerCase().split('').map(ch=>map[ch]??ch).join('');
}
function usernameBase(companyName:string,registrationNumber?:string|null){
  const base=latinize(companyName).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'.').replace(/^\.+|\.+$/g,'').slice(0,26);
  return base || `firma.${String(registrationNumber||'').slice(-6) || 'nalog'}`;
}
async function uniqueUsername(admin:any,companyName:string,registrationNumber?:string|null){
  const base=usernameBase(companyName,registrationNumber);
  for(let i=0;i<500;i++){
    const candidate=i===0?base:`${base.slice(0,Math.max(3,26-String(i+1).length-1))}.${i+1}`;
    const {data}=await admin.from('profiles').select('user_id').eq('username',candidate).maybeSingle();
    if(!data)return candidate;
  }
  return `${base.slice(0,18)}.${Date.now().toString().slice(-6)}`;
}

export async function POST(request:Request){
  const body=await request.json();
  const role=body.role==='accountant'?'accountant':'company';
  const email=String(body.email||'').trim().toLowerCase();
  const password=String(body.password||'');
  const companyId=String(body.company_id||'');
  const plan=body.plan==='premium'?'premium':'basic';
  const trial=body.trial!==false;
  const accountantCompanyId=String(body.accountant_company_id||'');
  const accountantEmail=String(body.accountant_email||'').trim().toLowerCase();
  const companyContactEmail=String(body.company_contact_email||'').trim().toLowerCase();
  const companyContactPhone=String(body.company_contact_phone||'').trim().slice(0,80);

  if(!EMAIL.test(email))return NextResponse.json({error:'Unesite ispravnu email adresu.'},{status:400});
  if(password.length<8)return NextResponse.json({error:'Lozinka mora imati najmanje 8 znakova.'},{status:400});
  if(!companyId)return NextResponse.json({error:'Pronađite i izaberite firmu.'},{status:400});
  if(accountantEmail&&!EMAIL.test(accountantEmail))return NextResponse.json({error:'Email knjigovođe nije ispravan.'},{status:400});
  if(companyContactEmail&&!EMAIL.test(companyContactEmail))return NextResponse.json({error:'Kontakt email firme nije ispravan.'},{status:400});

  const admin=createAdminClient();
  const {data:company}=await admin.from('companies').select('*').eq('id',companyId).maybeSingle();
  if(!company)return NextResponse.json({error:'Izabrana firma više nije dostupna. Ponovite pretragu registra.'},{status:400});

  const {data:existingEmail}=await admin.from('profiles').select('user_id').eq('auth_email',email).maybeSingle();
  if(existingEmail)return NextResponse.json({error:'Email adresa je već registrovana.'},{status:409});

  const username=await uniqueUsername(admin,company.name,company.registration_number);
  let newUserId:string|undefined;let newOrgId:string|undefined;
  try{
    const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{username,registration_role:role,company_id:company.id}});
    if(created.error||!created.data.user)throw new Error(created.error?.message||'Korisnik nije kreiran.');
    newUserId=created.data.user.id;

    const {error:profileError}=await admin.from('profiles').update({username,full_name:null,global_role:role==='accountant'?'accountant':'user',primary_company_id:company.id}).eq('user_id',newUserId);
    if(profileError)throw profileError;

    const {data:existingOrg}=await admin.from('organizations').select('id,name,owner_user_id,organization_type').eq('company_id',company.id).limit(1).maybeSingle();
    if(existingOrg){
      const {data:pendingAccess}=await admin.from('company_access_requests').select('id').eq('company_id',company.id).eq('requester_user_id',newUserId).eq('status','pending').maybeSingle();
      if(!pendingAccess)await admin.from('company_access_requests').insert({company_id:company.id,organization_id:existingOrg.id,requester_user_id:newUserId,requested_role:'employee',status:'pending'});
      const supabase=await createClient();await supabase.auth.signInWithPassword({email,password});
      return NextResponse.json({ok:true,created:true,username,access_request_pending:true,redirect:'/app'});
    }

    const now=new Date();const trialEnd=new Date(now.getTime()+10*24*60*60*1000).toISOString();
    const orgPayload:any={company_id:company.id,name:company.name,pib:company.pib,registration_number:company.registration_number,legal_form:company.legal_form,address:company.address,municipality:company.municipality||company.city,activity_code:company.activity_code,activity_name:company.activity_name,apr_raw:company.apr_raw||null,owner_user_id:newUserId,plan,status:trial?'trial':'pending_payment',organization_type:role==='accountant'?'accounting':'company',trial_ends_at:trial?trialEnd:null,contact_email:companyContactEmail||email,contact_phone:companyContactPhone||null};
    const {data:org,error:orgError}=await admin.from('organizations').insert(orgPayload).select('id').single();
    if(orgError||!org)throw orgError||new Error('Organizacija nije kreirana.');newOrgId=org.id;

    const {error:memberError}=await admin.from('organization_members').insert({organization_id:org.id,user_id:newUserId,role:'owner',accounting_access_role:role==='accountant'?'admin':'user'});
    if(memberError)throw memberError;

    const {error:subError}=await admin.from('subscriptions').insert({organization_id:org.id,company_id:company.id,plan,seat_count:1,status:trial?'trial':'pending_checkout',provider:trial?null:'lemonsqueezy',trial_started_at:trial?now.toISOString():null,trial_ends_at:trial?trialEnd:null,trial_used_at:trial?now.toISOString():null,current_period_end:trial?trialEnd:null});
    if(subError)throw subError;

    if(role==='accountant'){
      const {data:pending}=await admin.from('accountant_invitations').select('*').eq('status','pending').or(`accountant_company_id.eq.${company.id},accountant_pib.eq.${company.pib||'__none__'},email.eq.${email}`);
      for(const invite of pending||[]){
        const {data:clientOrg}=await admin.from('organizations').select('id,company_id').eq('id',invite.organization_id).maybeSingle();
        if(!clientOrg?.company_id)continue;
        await admin.from('accountant_company').upsert({accountant_organization_id:org.id,company_id:clientOrg.company_id,client_organization_id:clientOrg.id,status:'active',requested_by:invite.created_by||null,approved_by:invite.created_by||null,approved_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:'accountant_organization_id,company_id'});
        await admin.from('organization_members').upsert({organization_id:clientOrg.id,user_id:newUserId,role:'accountant'},{onConflict:'organization_id,user_id'});
        await admin.from('accountant_invitations').update({status:'accepted',accepted_by:newUserId,accepted_at:new Date().toISOString()}).eq('id',invite.id);
      }
    }

    if(role==='company'&&accountantCompanyId){
      const {data:accountingOrg}=await admin.from('organizations').select('id,name,owner_user_id').eq('company_id',accountantCompanyId).eq('organization_type','accounting').limit(1).maybeSingle();
      if(accountingOrg){
        await admin.from('accountant_company').upsert({accountant_organization_id:accountingOrg.id,company_id:company.id,client_organization_id:org.id,status:'active',requested_by:newUserId,approved_by:newUserId,approved_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:'accountant_organization_id,company_id'});
        await admin.from('organization_members').upsert({organization_id:org.id,user_id:accountingOrg.owner_user_id,role:'accountant'},{onConflict:'organization_id,user_id'});
      }else{
        const {data:accCompany}=await admin.from('companies').select('pib,name').eq('id',accountantCompanyId).maybeSingle();
        await admin.from('accountant_invitations').insert({organization_id:org.id,accountant_company_id:accountantCompanyId,accountant_pib:accCompany?.pib||null,email:accountantEmail||null,status:'pending',created_by:newUserId});
        if(accountantEmail){try{await sendAccountantInvite({to:accountantEmail,companyName:company.name,registerUrl:new URL('/register',request.url).toString()});}catch{}}
      }
    }

    const supabase=await createClient();const login=await supabase.auth.signInWithPassword({email,password});
    if(login.error)return NextResponse.json({ok:true,created:true,username,requires_login:true,redirect:'/login'});
    return NextResponse.json({ok:true,created:true,username,organization_id:org.id,checkout_required:!trial,redirect:trial?'/app':'/app/subscription'});
  }catch(e:any){
    if(newOrgId){try{await admin.from('organizations').delete().eq('id',newOrgId);}catch{}}
    if(newUserId){try{await admin.auth.admin.deleteUser(newUserId);}catch{}}
    return NextResponse.json({error:e?.message||'Registracija nije uspela.'},{status:400});
  }
}
