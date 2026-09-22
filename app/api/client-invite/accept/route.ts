import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { hashInviteToken } from '@/lib/invite-token';

function cleanUsername(value:string){return value.toLowerCase().replace(/[^a-z0-9._-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,26)||'firma';}

export async function POST(request:Request){
  const {token,password}=await request.json();
  const rawToken=String(token||'');
  const pass=String(password||'');
  if(pass.length<8) return NextResponse.json({error:'Lozinka mora imati najmanje 8 znakova.'},{status:400});
  const admin=createAdminClient();
  const tokenHash=await hashInviteToken(rawToken);
  const {data:invite}=await admin.from('client_invitations').select('*').eq('token_hash',tokenHash).maybeSingle();
  if(!invite||invite.status!=='pending') return NextResponse.json({error:'Poziv nije aktivan.'},{status:410});
  if(new Date(invite.expires_at).getTime()<Date.now()){
    await admin.from('client_invitations').update({status:'expired'}).eq('id',invite.id);
    return NextResponse.json({error:'Poziv je istekao.'},{status:410});
  }
  if(!invite.email) return NextResponse.json({error:'Za aktivaciju naloga potreban je email. Kontaktirajte knjigovođu.'},{status:400});

  const {data:existingProfile}=await admin.from('profiles').select('user_id,username').eq('auth_email',String(invite.email).toLowerCase()).maybeSingle();
  if(existingProfile) return NextResponse.json({error:'Ovaj email već ima Fiskalni Inbox nalog. Prijavite se postojećim nalogom i kontaktirajte knjigovođu.'},{status:409});

  const snap:any=invite.company_snapshot||{};
  const base=cleanUsername(`firma_${invite.company_pib}`);
  let username=base;
  for(let i=0;i<20;i++){
    const candidate=i===0?base:`${base}_${i+1}`;
    const {data:hit}=await admin.from('profiles').select('user_id').eq('username',candidate).maybeSingle();
    if(!hit){username=candidate;break;}
  }

  let userId:string|undefined;
  let orgId:string|undefined;
  try{
    const created=await admin.auth.admin.createUser({email:String(invite.email).toLowerCase(),password:pass,email_confirm:true,user_metadata:{username,registration_role:'company'}});
    if(created.error||!created.data.user) throw new Error(created.error?.message||'Nalog nije kreiran.');
    userId=created.data.user.id;
    const {error:profileError}=await admin.from('profiles').update({username,global_role:'user'}).eq('user_id',userId);
    if(profileError) throw profileError;

    const now=new Date();
    const trialEnd=new Date(now.getTime()+10*24*60*60*1000).toISOString();
    const {data:org,error:orgError}=await admin.from('organizations').insert({
      name:invite.company_name,
      pib:invite.company_pib,
      registration_number:invite.company_registration_number||snap.registration_number||null,
      legal_form:snap.legal_form||null,
      address:snap.address||null,
      municipality:snap.municipality||null,
      activity_code:snap.activity_code||null,
      activity_name:snap.activity_name||null,
      apr_raw:snap.raw||null,
      owner_user_id:userId,
      plan:'trial',status:'trial',organization_type:'company',trial_ends_at:trialEnd,
      contact_email:invite.email||null,contact_phone:invite.phone||null
    }).select('id').single();
    if(orgError||!org) throw orgError||new Error('Firma nije kreirana.');
    orgId=org.id;
    await admin.from('organization_members').insert({organization_id:org.id,user_id:userId,role:'owner'});
    await admin.from('subscriptions').insert({organization_id:org.id,plan:'trial',seat_count:1,status:'trial',trial_started_at:now.toISOString(),trial_ends_at:trialEnd,current_period_end:trialEnd});

    const {data:office}=await admin.from('organizations').select('owner_user_id').eq('id',invite.accounting_organization_id).single();
    if(office?.owner_user_id){
      await admin.from('organization_members').upsert({organization_id:org.id,user_id:office.owner_user_id,role:'accountant'},{onConflict:'organization_id,user_id'});
    }
    if(invite.assigned_employee_id){
      await admin.from('organization_members').upsert({organization_id:org.id,user_id:invite.assigned_employee_id,role:'accountant'},{onConflict:'organization_id,user_id'});
      await admin.from('accountant_client_assignments').upsert({accounting_organization_id:invite.accounting_organization_id,employee_user_id:invite.assigned_employee_id,client_organization_id:org.id,assigned_by:office?.owner_user_id||invite.invited_by},{onConflict:'accounting_organization_id,employee_user_id,client_organization_id'});
    }
    await admin.from('client_invitations').update({status:'accepted',accepted_at:new Date().toISOString(),accepted_by:userId,accepted_organization_id:org.id}).eq('id',invite.id);

    const supabase=await createClient();
    const login=await supabase.auth.signInWithPassword({email:String(invite.email).toLowerCase(),password:pass});
    return NextResponse.json({ok:true,username,organization_id:org.id,redirect:login.error?'/login':'/app'});
  }catch(e:any){
    if(orgId){try{await admin.from('organizations').delete().eq('id',orgId);}catch{}}
    if(userId){try{await admin.auth.admin.deleteUser(userId);}catch{}}
    return NextResponse.json({error:e?.message||'Aktivacija nije uspela.'},{status:400});
  }
}
