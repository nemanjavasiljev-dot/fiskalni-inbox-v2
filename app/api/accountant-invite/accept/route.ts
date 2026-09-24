import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashInviteToken } from '@/lib/invite-token';
import { emailBelongsToAccountingOrganization, resolveAccountingOrganization } from '@/lib/accountant-verification';

export async function POST(request:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user||!user.email_confirmed_at)return NextResponse.json({error:'Prijavite se potvrđenim nalogom knjigovođe da biste prihvatili poziv.'},{status:401});
  const body=await request.json().catch(()=>({}));
  const token=String(body.token||'');
  if(!token)return NextResponse.json({error:'Nedostaje verifikacioni token.'},{status:400});
  const admin=createAdminClient();
  const tokenHash=await hashInviteToken(token);
  const {data:invite}=await admin.from('accountant_invitations').select('*').eq('token_hash',tokenHash).maybeSingle();
  if(!invite)return NextResponse.json({error:'Verifikacioni link nije pronađen.'},{status:404});
  if(invite.status==='accepted')return NextResponse.json({ok:true,alreadyAccepted:true,message:'Klijent je već dodat u FiscalBox.',redirect:'/app'});
  if(invite.status!=='pending')return NextResponse.json({error:'Ovaj verifikacioni link više nije aktivan.'},{status:410});
  if(invite.expires_at&&new Date(invite.expires_at).getTime()<Date.now())return NextResponse.json({error:'Verifikacioni link je istekao. Zatražite novi poziv od klijenta.'},{status:410});

  const accountingOrg=await resolveAccountingOrganization(admin,invite.accountant_pib||'');
  if(!accountingOrg){
    return NextResponse.json({error:'Knjigovodstvena firma sa ovim PIB-om još nema FiscalBox nalog.',code:'ACCOUNTANT_NOT_REGISTERED',register_url:'/register'},{status:409});
  }

  const {data:member}=await admin.from('organization_members').select('role,accounting_access_role').eq('organization_id',accountingOrg.id).eq('user_id',user.id).maybeSingle();
  if(!member || !(member.role==='owner'||(member.role==='employee'&&member.accounting_access_role==='admin')))return NextResponse.json({error:'Poziv može prihvatiti samo administrator pozvane agencije.'},{status:403});
  const verified={acceptingUserId:user.id};

  const {data:clientOrg}=await admin.from('organizations').select('id,name,company_id').eq('id',invite.organization_id).maybeSingle();
  if(!clientOrg?.company_id)return NextResponse.json({error:'Klijent nije pravilno povezan sa registrom.'},{status:409});

  const now=new Date().toISOString();
  const {error:relError}=await admin.from('accountant_company').upsert({
    accountant_organization_id:accountingOrg.id,
    company_id:clientOrg.company_id,
    client_organization_id:clientOrg.id,
    status:'active',
    requested_by:invite.created_by||null,
    approved_by:verified.acceptingUserId||accountingOrg.owner_user_id,
    approved_at:now,
    updated_at:now
  },{onConflict:'accountant_organization_id,company_id'});
  if(relError)return NextResponse.json({error:relError.message},{status:400});

  const accessUsers=Array.from(new Set([String(accountingOrg.owner_user_id||''),String(verified.acceptingUserId||'')].filter(Boolean)));
  for(const userId of accessUsers){
    const {error}=await admin.from('organization_members').upsert({organization_id:clientOrg.id,user_id:userId,role:'accountant'},{onConflict:'organization_id,user_id',ignoreDuplicates:true});
    if(error)return NextResponse.json({error:error.message},{status:400});
  }

  await admin.from('organizations').update({accountant_pib_pending:invite.accountant_pib,accountant_contact_email:invite.email}).eq('id',clientOrg.id);
  await admin.from('accountant_invitations').update({status:'accepted',accepted_by:verified.acceptingUserId||accountingOrg.owner_user_id,accepted_at:now,verified_at:now,accountant_organization_id:accountingOrg.id}).eq('id',invite.id);

  return NextResponse.json({ok:true,message:`Klijent ${clientOrg.name} je uspešno dodat u vaš FiscalBox dashboard.`,redirect:'/app'});
}
