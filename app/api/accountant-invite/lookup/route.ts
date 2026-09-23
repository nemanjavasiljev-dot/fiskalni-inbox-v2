import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashInviteToken } from '@/lib/invite-token';
import { resolveAccountingOrganization } from '@/lib/accountant-verification';

export async function GET(request:Request){
  const token=new URL(request.url).searchParams.get('token')||'';
  if(!token)return NextResponse.json({error:'Nedostaje verifikacioni token.'},{status:400});
  const admin=createAdminClient();
  const tokenHash=await hashInviteToken(token);
  const {data:invite}=await admin.from('accountant_invitations')
    .select('id,organization_id,accountant_pib,email,status,expires_at,accepted_at')
    .eq('token_hash',tokenHash).maybeSingle();
  if(!invite)return NextResponse.json({error:'Verifikacioni link nije pronađen.'},{status:404});
  if(invite.status==='accepted')return NextResponse.json({ok:true,alreadyAccepted:true,message:'Ovaj klijent je već prihvaćen.'});
  if(invite.status!=='pending')return NextResponse.json({error:'Ovaj verifikacioni link više nije aktivan.'},{status:410});
  if(invite.expires_at&&new Date(invite.expires_at).getTime()<Date.now())return NextResponse.json({error:'Verifikacioni link je istekao. Zatražite novi poziv od klijenta.'},{status:410});
  const {data:clientOrg}=await admin.from('organizations').select('id,name,pib').eq('id',invite.organization_id).maybeSingle();
  const accountingOrg=await resolveAccountingOrganization(admin,invite.accountant_pib||'');
  return NextResponse.json({ok:true,company:clientOrg?{name:clientOrg.name,pib:clientOrg.pib}:null,accountant_pib:invite.accountant_pib,email:invite.email,accountant_registered:Boolean(accountingOrg)});
}
