import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { aprLookup } from '@/lib/apr';
import { createInviteToken, hashInviteToken } from '@/lib/invite-token';
import { sendClientInvite } from '@/lib/mailer';
import { sendSms } from '@/lib/sms';

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.json({error:'Niste prijavljeni.'},{status:401});
  const body=await request.json();
  const pib=String(body.pib||'').replace(/\D/g,'');
  const email=String(body.email||'').trim().toLowerCase();
  const phone=String(body.phone||'').trim();
  const channel=['email','sms','both'].includes(body.channel)?body.channel:'email';
  const manualName=String(body.company_name||'').trim();
  if(pib.length!==9) return NextResponse.json({error:'PIB klijenta mora imati 9 cifara.'},{status:400});
  if(!EMAIL.test(email)) return NextResponse.json({error:'Unesite ispravan email klijenta.'},{status:400});
  if(!phone) return NextResponse.json({error:'Unesite broj telefona klijenta.'},{status:400});

  const {data:officeMemberships}=await supabase.from('organization_members')
    .select('organization_id,role,organizations(id,name,owner_user_id,organization_type)')
    .eq('user_id',user.id).in('role',['owner','employee']);
  const officeMembership:any=(officeMemberships||[]).find((m:any)=>m.organizations?.organization_type==='accounting');
  if(!officeMembership) return NextResponse.json({error:'Nalog nije povezan sa knjigovodstvenom agencijom.'},{status:403});
  const office:any=officeMembership.organizations;
  const admin=createAdminClient();

  const {data:existingOrg}=await admin.from('organizations').select('id,name,pib,owner_user_id,organization_type').eq('pib',pib).eq('organization_type','company').maybeSingle();
  if(existingOrg){
    await admin.from('organization_members').upsert({organization_id:existingOrg.id,user_id:office.owner_user_id,role:'accountant'},{onConflict:'organization_id,user_id'});
    if(officeMembership.role==='employee'){
      await admin.from('organization_members').upsert({organization_id:existingOrg.id,user_id:user.id,role:'accountant'},{onConflict:'organization_id,user_id'});
      await admin.from('accountant_client_assignments').upsert({accounting_organization_id:office.id,employee_user_id:user.id,client_organization_id:existingOrg.id,assigned_by:office.owner_user_id},{onConflict:'accounting_organization_id,employee_user_id,client_organization_id'});
    }
    return NextResponse.json({ok:true,linked_existing:true,organization_id:existingOrg.id,name:existingOrg.name});
  }

  let company:any=null;
  let aprConfigured=true;
  try{ company=(await aprLookup(pib)).company; }
  catch(e:any){ aprConfigured=e?.code!=='APR_NOT_CONFIGURED'; }
  const companyName=String(company?.name||manualName||'').trim();
  if(!companyName) return NextResponse.json({error:'APR nije vratio naziv. Unesite naziv klijenta ručno.',apr_configured:aprConfigured},{status:400});

  const token=createInviteToken();
  const tokenHash=await hashInviteToken(token);
  const snapshot={
    name:companyName,
    pib:String(company?.pib||pib).replace(/\D/g,'')||pib,
    registration_number:String(company?.registration_number||'').replace(/\D/g,'')||null,
    legal_form:company?.legal_form||null,
    address:company?.address||null,
    municipality:company?.municipality||null,
    activity_code:company?.activity_code||null,
    activity_name:company?.activity_name||null,
    raw:company?.raw||null
  };
  const expiresAt=new Date(Date.now()+30*24*60*60*1000).toISOString();
  const {data:invite,error}=await admin.from('client_invitations').insert({
    accounting_organization_id:office.id,
    invited_by:user.id,
    assigned_employee_id:officeMembership.role==='employee'?user.id:null,
    company_pib:pib,
    company_registration_number:snapshot.registration_number,
    company_name:companyName,
    company_snapshot:snapshot,
    email:email||null,
    phone:phone||null,
    invite_channel:channel,
    token_hash:tokenHash,
    expires_at:expiresAt
  }).select('id').single();
  if(error||!invite) return NextResponse.json({error:error?.message||'Poziv nije sačuvan.'},{status:400});

  const origin=new URL(request.url).origin;
  const inviteUrl=`${origin}/invite/client?token=${encodeURIComponent(token)}`;
  let emailResult:any={sent:false,configured:false};
  let smsResult:any={sent:false,configured:false};
  if(channel==='email'||channel==='both'){
    try{emailResult=await sendClientInvite({to:email,accountingOffice:office.name,companyName,inviteUrl});}catch{}
  }
  if(channel==='sms'||channel==='both'){
    try{smsResult=await sendSms({to:phone,body:`${office.name} vas poziva u FiscalBox za ${companyName}. Aktivacija: ${inviteUrl}`});}catch{}
  }
  await admin.from('client_invitations').update({sent_at:(emailResult.sent||smsResult.sent)?new Date().toISOString():null}).eq('id',invite.id);
  return NextResponse.json({ok:true,invite_id:invite.id,invite_url:inviteUrl,company:snapshot,email:emailResult,sms:smsResult,apr_configured:aprConfigured});
}
