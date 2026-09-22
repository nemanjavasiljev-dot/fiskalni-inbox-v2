import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { sendAccountantInvite } from '@/lib/mailer';
import { createPlanProforma } from '@/lib/billing';

const USERNAME=/^[a-z0-9._-]{3,30}$/;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request:Request){
  const body=await request.json();
  const role=body.role==='accountant'?'accountant':'company';
  const username=String(body.username||'').trim().toLowerCase();
  const email=String(body.email||'').trim().toLowerCase();
  const password=String(body.password||'');
  const fullName=String(body.full_name||'').trim();
  const company=body.company||{};
  const plan=['trial','basic','premium'].includes(body.plan)?body.plan:'trial';
  const accountantPib=String(body.accountant_pib||'').replace(/\D/g,'');
  const accountantEmail=String(body.accountant_email||'').trim().toLowerCase();

  if(!USERNAME.test(username)) return NextResponse.json({error:'Korisničko ime: 3–30 znakova, mala slova, brojevi, tačka, crtica ili donja crta.'},{status:400});
  if(!EMAIL.test(email)) return NextResponse.json({error:'Unesite ispravnu email adresu.'},{status:400});
  if(password.length<8) return NextResponse.json({error:'Lozinka mora imati najmanje 8 znakova.'},{status:400});
  if(!String(company.name||'').trim()) return NextResponse.json({error:'Naziv firme je obavezan.'},{status:400});
  if(![8,9].includes(String(company.pib||company.registration_number||'').replace(/\D/g,'').length)) return NextResponse.json({error:'Unesite PIB ili matični broj firme.'},{status:400});
  if(role==='company' && accountantPib && accountantPib.length!==9) return NextResponse.json({error:'PIB knjigovođe mora imati 9 cifara.'},{status:400});
  if(role==='company' && accountantEmail && !EMAIL.test(accountantEmail)) return NextResponse.json({error:'Email knjigovođe nije ispravan.'},{status:400});

  const admin=createAdminClient();
  const {data:existingUsername}=await admin.from('profiles').select('user_id').eq('username',username).maybeSingle();
  if(existingUsername) return NextResponse.json({error:'Korisničko ime je zauzeto.'},{status:409});
  const {data:existingEmail}=await admin.from('profiles').select('user_id').eq('auth_email',email).maybeSingle();
  if(existingEmail) return NextResponse.json({error:'Email adresa je već registrovana.'},{status:409});

  let newUserId:string|undefined;
  let newOrgId:string|undefined;
  try{
    const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{username,full_name:fullName,registration_role:role}});
    if(created.error||!created.data.user) throw new Error(created.error?.message||'Korisnik nije kreiran.');
    newUserId=created.data.user.id;

    const {error:profileError}=await admin.from('profiles').update({username,full_name:fullName||null,global_role:role==='accountant'?'accountant':'user'}).eq('user_id',newUserId);
    if(profileError) throw profileError;

    const now=new Date();
    const trialEnd=new Date(now.getTime()+10*24*60*60*1000).toISOString();
    const orgPayload:any={
      name:String(company.name).trim(),
      pib:String(company.pib||'').replace(/\D/g,'')||null,
      registration_number:String(company.registration_number||'').replace(/\D/g,'')||null,
      legal_form:String(company.legal_form||'').trim()||null,
      address:String(company.address||'').trim()||null,
      municipality:String(company.municipality||'').trim()||null,
      activity_code:String(company.activity_code||'').trim()||null,
      activity_name:String(company.activity_name||'').trim()||null,
      apr_raw:company.apr_raw||null,
      owner_user_id:newUserId,
      plan,
      status:plan==='trial'?'trial':'active',
      organization_type:role==='accountant'?'accounting':'company',
      trial_ends_at:plan==='trial'?trialEnd:null,
      accountant_pib_pending:role==='company'&&accountantPib?accountantPib:null,
      accountant_contact_email:role==='company'&&accountantEmail?accountantEmail:null
    };
    const {data:org,error:orgError}=await admin.from('organizations').insert(orgPayload).select('id').single();
    if(orgError||!org) throw orgError||new Error('Organizacija nije kreirana.');
    newOrgId=org.id;

    const {error:memberError}=await admin.from('organization_members').insert({organization_id:org.id,user_id:newUserId,role:'owner'});
    if(memberError) throw memberError;

    const {error:subError}=await admin.from('subscriptions').insert({organization_id:org.id,plan,seat_count:1,status:plan==='trial'?'trial':'active',trial_started_at:plan==='trial'?now.toISOString():null,trial_ends_at:plan==='trial'?trialEnd:null,current_period_end:plan==='trial'?trialEnd:null});
    if(subError) throw subError;

    // Paid plans immediately receive a demo proforma and email when Resend is configured.
    if(plan!=='trial'){
      try{await createPlanProforma({admin,organization:{...orgPayload,id:org.id},plan,seats:1,recipientEmail:email,appBillingUrl:new URL('/app/billing',request.url).toString()});}catch{}
    }

    // If an accountant was invited before registering, connect all matching clients automatically.
    if(role==='accountant'){
      const accountantOwnPib=String(company.pib||'').replace(/\D/g,'');
      let invitationQuery=admin.from('accountant_invitations').select('id,organization_id,accountant_pib,email').eq('status','pending');
      if(accountantOwnPib) invitationQuery=invitationQuery.or(`accountant_pib.eq.${accountantOwnPib},email.eq.${email}`);
      else invitationQuery=invitationQuery.eq('email',email);
      const {data:pendingInvites}=await invitationQuery;
      for(const invite of pendingInvites||[]){
        await admin.from('organization_members').upsert({organization_id:invite.organization_id,user_id:newUserId,role:'accountant'},{onConflict:'organization_id,user_id'});
        await admin.from('accountant_invitations').update({status:'accepted',accepted_by:newUserId,accepted_at:new Date().toISOString()}).eq('id',invite.id);
        await admin.from('organizations').update({accountant_pib_pending:null,accountant_contact_email:null}).eq('id',invite.organization_id);
      }
    }

    let accountantFound=false;
    if(role==='company'&&accountantPib){
      const {data:accountingOrg}=await admin.from('organizations').select('id,name,owner_user_id,organization_type').eq('pib',accountantPib).limit(1).maybeSingle();
      if(accountingOrg){
        const {data:accountantProfile}=await admin.from('profiles').select('global_role').eq('user_id',accountingOrg.owner_user_id).maybeSingle();
        if(accountingOrg.organization_type==='accounting'||accountantProfile?.global_role==='accountant'){
          const {error:linkError}=await admin.from('organization_members').insert({organization_id:org.id,user_id:accountingOrg.owner_user_id,role:'accountant'});
          if(!linkError){
            accountantFound=true;
            await admin.from('organizations').update({accountant_pib_pending:null,accountant_contact_email:null}).eq('id',org.id);
          }
        }
      }
    }
    if(role==='company'&&!accountantFound&&(accountantPib||accountantEmail)){
      await admin.from('accountant_invitations').insert({organization_id:org.id,accountant_pib:accountantPib||null,email:accountantEmail||null,status:'pending',created_by:newUserId});
      if(accountantEmail){
        try{await sendAccountantInvite({to:accountantEmail,companyName:String(company.name),registerUrl:new URL('/register',request.url).toString()});}catch{}
      }
    }

    const supabase=await createClient();
    const login=await supabase.auth.signInWithPassword({email,password});
    if(login.error) return NextResponse.json({ok:true,created:true,requires_login:true,redirect:'/login'});
    return NextResponse.json({ok:true,created:true,organization_id:org.id,redirect:'/app'});
  }catch(e:any){
    if(newOrgId){ try{await admin.from('organizations').delete().eq('id',newOrgId);}catch{} }
    if(newUserId){ try{await admin.auth.admin.deleteUser(newUserId);}catch{} }
    return NextResponse.json({error:e?.message||'Registracija nije uspela.'},{status:400});
  }
}
