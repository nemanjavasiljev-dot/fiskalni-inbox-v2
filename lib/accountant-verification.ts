import { createInviteToken, hashInviteToken } from '@/lib/invite-token';
import { sendAccountantInvite } from '@/lib/mailer';

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizePib(value:any){
  return String(value||'').replace(/\D/g,'').slice(0,9);
}

export function normalizeEmail(value:any){
  return String(value||'').trim().toLowerCase();
}

export async function resolveAccountingOrganization(admin:any,pib:string){
  const normalized=normalizePib(pib);
  if(!/^\d{9}$/.test(normalized))return null;

  const {data:direct}=await admin.from('organizations')
    .select('id,name,pib,company_id,owner_user_id,contact_email')
    .eq('organization_type','accounting')
    .eq('pib',normalized)
    .limit(1)
    .maybeSingle();
  if(direct)return direct;

  const {data:company}=await admin.from('companies')
    .select('id,name,pib')
    .eq('pib',normalized)
    .limit(1)
    .maybeSingle();
  if(!company)return null;

  const {data:byCompany}=await admin.from('organizations')
    .select('id,name,pib,company_id,owner_user_id,contact_email')
    .eq('organization_type','accounting')
    .eq('company_id',company.id)
    .limit(1)
    .maybeSingle();
  return byCompany||null;
}

export async function createAccountantVerificationInvite(opts:{
  admin:any;
  requestUrl:string;
  organizationId:string;
  accountantPib:string;
  accountantEmail:string;
  createdBy?:string|null;
}){
  const {admin,requestUrl,organizationId}=opts;
  const accountantPib=normalizePib(opts.accountantPib);
  const accountantEmail=normalizeEmail(opts.accountantEmail);
  if(!/^\d{9}$/.test(accountantPib))throw new Error('PIB knjigovođe mora imati tačno 9 cifara.');
  if(!EMAIL.test(accountantEmail))throw new Error('Email knjigovođe nije ispravan.');

  const {data:clientOrg}=await admin.from('organizations')
    .select('id,name,pib,company_id')
    .eq('id',organizationId)
    .maybeSingle();
  if(!clientOrg?.company_id)throw new Error('Firma nije pravilno povezana sa centralnim registrom.');

  const accountingOrg=await resolveAccountingOrganization(admin,accountantPib);
  if(accountingOrg){
    const recipient=await emailBelongsToAccountingOrganization(admin,accountingOrg,accountantEmail);
    if(!recipient.ok)throw new Error('Uneti email nije povezan sa FiscalBox nalogom knjigovodstvene firme za navedeni PIB. Proverite email sa knjigovođom.');
  }
  let accountantCompanyId=accountingOrg?.company_id||null;
  if(!accountantCompanyId){
    const {data:company}=await admin.from('companies').select('id').eq('pib',accountantPib).limit(1).maybeSingle();
    accountantCompanyId=company?.id||null;
  }

  // Stari neiskorišćeni pozivi za isti PIB više ne važe.
  await admin.from('accountant_invitations')
    .update({status:'cancelled'})
    .eq('organization_id',organizationId)
    .eq('accountant_pib',accountantPib)
    .eq('status','pending');

  const token=createInviteToken();
  const tokenHash=await hashInviteToken(token);
  const expiresAt=new Date(Date.now()+7*24*60*60*1000).toISOString();
  const verifyUrl=new URL(`/invite/accountant?token=${encodeURIComponent(token)}`,requestUrl).toString();

  const {data:invite,error:inviteError}=await admin.from('accountant_invitations').insert({
    organization_id:organizationId,
    accountant_company_id:accountantCompanyId,
    accountant_organization_id:accountingOrg?.id||null,
    accountant_pib:accountantPib,
    email:accountantEmail,
    status:'pending',
    created_by:opts.createdBy||null,
    token_hash:tokenHash,
    expires_at:expiresAt
  }).select('id').single();
  if(inviteError||!invite)throw new Error(inviteError?.message||'Poziv nije kreiran.');

  const emailResult=await sendAccountantInvite({
    to:accountantEmail,
    companyName:clientOrg.name,
    companyPib:clientOrg.pib||'',
    accountantPib,
    verifyUrl,
    expiresAt
  });

  if(!emailResult.sent){
    await admin.from('accountant_invitations').update({status:'cancelled'}).eq('id',invite.id);
    if(!emailResult.configured)throw new Error('Email servis nije podešen. Dodajte RESEND_API_KEY i APP_EMAIL_FROM u Vercel Environment Variables.');
    throw new Error(`Email nije poslat${emailResult.status?` (HTTP ${emailResult.status})`:''}. Pokušajte ponovo.`);
  }

  await admin.from('accountant_invitations').update({verification_sent_at:new Date().toISOString()}).eq('id',invite.id);
  await admin.from('organizations').update({accountant_pib_pending:accountantPib,accountant_contact_email:accountantEmail}).eq('id',organizationId);

  return {inviteId:invite.id,email:accountantEmail,pib:accountantPib,accountingOrgFound:Boolean(accountingOrg),expiresAt};
}

export async function emailBelongsToAccountingOrganization(admin:any,accountingOrg:any,email:string){
  const wanted=normalizeEmail(email);
  const {data:members}=await admin.from('organization_members')
    .select('user_id,role')
    .eq('organization_id',accountingOrg.id)
    .in('role',['owner','employee']);
  const ids=Array.from(new Set<string>([String(accountingOrg.owner_user_id||''),...(members||[]).map((m:any)=>String(m.user_id))].filter(Boolean)));
  const {data:profiles}=ids.length?await admin.from('profiles').select('user_id,auth_email').in('user_id',ids):{data:[]};
  const matched=(profiles||[]).find((p:any)=>normalizeEmail(p.auth_email)===wanted);
  const contactMatch=normalizeEmail(accountingOrg.contact_email)===wanted;
  return {
    ok:Boolean(matched||contactMatch),
    acceptingUserId:String(matched?.user_id||accountingOrg.owner_user_id||''),
    memberUserIds:ids
  };
}
