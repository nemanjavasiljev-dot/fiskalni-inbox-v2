import { sendConnectionRequestEmail } from '@/lib/mailer';
import { sendSms } from '@/lib/sms';
import { sendPushToOrganization } from '@/lib/push-delivery';

export type OrganizationKind='company'|'accounting';
export type InviteChannel='email'|'sms';

export function normalizeEmail(value:any){
  return String(value||'').trim().toLowerCase();
}

export function normalizePhone(value:any){
  let digits=String(value||'').replace(/\D/g,'');
  if(digits.startsWith('00'))digits=digits.slice(2);
  if(digits.startsWith('0'))digits=`381${digits.slice(1)}`;
  if(digits && !digits.startsWith('381') && digits.length<=10)digits=`381${digits}`;
  return digits?`+${digits}`:'';
}

export function validEmail(value:string){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)}
export function validPhone(value:string){return /^\+\d{8,15}$/.test(value)}

async function resolveTargetByEmail(admin:any,targetKind:OrganizationKind,email:string){
  const direct=await admin.from('organizations')
    .select('id,name,organization_type,owner_user_id,contact_email,contact_phone,company_id')
    .eq('organization_type',targetKind)
    .eq('contact_email',email)
    .limit(1)
    .maybeSingle();
  if(direct.data)return direct.data;

  const {data:profile}=await admin.from('profiles').select('user_id').eq('auth_email',email).limit(1).maybeSingle();
  if(!profile?.user_id)return null;
  const {data:members}=await admin.from('organization_members').select('organization_id').eq('user_id',profile.user_id);
  const ids=(members||[]).map((x:any)=>x.organization_id);
  if(!ids.length)return null;
  const {data:orgs}=await admin.from('organizations')
    .select('id,name,organization_type,owner_user_id,contact_email,contact_phone,company_id')
    .in('id',ids)
    .eq('organization_type',targetKind)
    .limit(10);
  return orgs?.[0]||null;
}

async function resolveTargetByPhone(admin:any,targetKind:OrganizationKind,phone:string){
  const {data:orgs}=await admin.from('organizations')
    .select('id,name,organization_type,owner_user_id,contact_email,contact_phone,company_id')
    .eq('organization_type',targetKind)
    .not('contact_phone','is',null)
    .limit(5000);
  return (orgs||[]).find((o:any)=>normalizePhone(o.contact_phone)===phone)||null;
}

export async function createConnectionRequest(opts:{
  admin:any;
  requestUrl:string;
  senderOrganizationId:string;
  senderUserId?:string|null;
  channel:InviteChannel;
  contact:string;
}){
  const {admin}=opts;
  const {data:senderOrg}=await admin.from('organizations')
    .select('id,name,organization_type,company_id,contact_email,contact_phone')
    .eq('id',opts.senderOrganizationId)
    .maybeSingle();
  if(!senderOrg)throw new Error('Organizacija koja šalje zahtev nije pronađena.');
  const senderKind:OrganizationKind=senderOrg.organization_type==='accounting'?'accounting':'company';
  const targetKind:OrganizationKind=senderKind==='company'?'accounting':'company';
  const channel:InviteChannel=opts.channel==='sms'?'sms':'email';
  const email=channel==='email'?normalizeEmail(opts.contact):'';
  const phone=channel==='sms'?normalizePhone(opts.contact):'';
  if(channel==='email'&&!validEmail(email))throw new Error('Unesite ispravnu email adresu.');
  if(channel==='sms'&&!validPhone(phone))throw new Error('Unesite ispravan broj telefona, npr. +381601234567.');

  const targetOrg=channel==='email'
    ? await resolveTargetByEmail(admin,targetKind,email)
    : await resolveTargetByPhone(admin,targetKind,phone);

  if(channel==='sms'&&!targetOrg)throw new Error('Za SMS povezivanje primalac mora već imati nalog. Za novog primaoca koristite email.');

  // Stari isti zahtev više nije aktivan.
  let oldQuery=admin.from('connection_requests')
    .update({status:'cancelled',updated_at:new Date().toISOString()})
    .eq('sender_organization_id',senderOrg.id)
    .eq('target_kind',targetKind)
    .eq('status','pending')
    .eq('channel',channel);
  if(channel==='email')oldQuery=oldQuery.eq('recipient_email',email);
  else oldQuery=oldQuery.eq('recipient_phone',phone);
  await oldQuery;

  const expiresAt=new Date(Date.now()+30*24*60*60*1000).toISOString();
  const {data:requestRow,error}=await admin.from('connection_requests').insert({
    sender_organization_id:senderOrg.id,
    sender_user_id:opts.senderUserId||null,
    sender_kind:senderKind,
    target_kind:targetKind,
    target_organization_id:targetOrg?.id||null,
    channel,
    recipient_email:email||null,
    recipient_phone:phone||null,
    status:'pending',
    expires_at:expiresAt
  }).select('id').single();
  if(error||!requestRow)throw new Error(error?.message||'Zahtev nije kreiran.');

  const appUrl=new URL('/app',opts.requestUrl).toString();
  let delivery:any={sent:false,configured:false};
  if(channel==='email'){
    delivery=await sendConnectionRequestEmail({
      to:email,
      senderName:senderOrg.name,
      senderKind,
      appUrl
    });
  }else{
    delivery=await sendSms({
      to:phone,
      body:`FiscalBox: ${senderOrg.name} vam šalje zahtev za povezivanje. Prijavite se i prihvatite zahtev u dashboardu: ${appUrl}`
    });
  }

  if(!delivery.sent){
    await admin.from('connection_requests').update({status:'cancelled',updated_at:new Date().toISOString()}).eq('id',requestRow.id);
    if(!delivery.configured){
      throw new Error(channel==='email'
        ? 'Email servis nije podešen. Proverite RESEND_API_KEY i APP_EMAIL_FROM.'
        : 'SMS servis nije podešen. Proverite TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN i TWILIO_FROM_NUMBER.');
    }
    throw new Error(`${channel==='email'?'Email':'SMS'} nije poslat${delivery.status?` (HTTP ${delivery.status})`:''}.`);
  }

  await admin.from('connection_requests').update({sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',requestRow.id);
  if(targetOrg?.id){
    await sendPushToOrganization(admin,String(targetOrg.id),{
      title:'Novi zahtev za povezivanje',
      body:`${senderOrg.name} vam je poslao zahtev. Otvorite FiscalBox i prihvatite ili odbijte zahtev.`,
      url:'/app',tag:`connection-${requestRow.id}`
    }).catch(()=>{});
  }
  return {id:requestRow.id,channel,contact:email||phone,targetFound:Boolean(targetOrg),targetOrganizationId:targetOrg?.id||null,expiresAt};
}

export function requestMatchesRecipient(req:any,userEmail:string,org:any){
  if(req.target_organization_id && String(req.target_organization_id)===String(org?.id||org?.organization_id))return true;
  if(req.target_organization_id) return false;
  if(req.channel==='email'){
    const wanted=normalizeEmail(req.recipient_email);
    return Boolean(wanted && wanted===normalizeEmail(userEmail));
  }
  // An unverified editable phone is not proof of invitation ownership.
  if(req.channel==='sms')return false;
  return false;
}
