import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashInviteToken } from '@/lib/invite-token';

export async function GET(request:Request){
  const token=new URL(request.url).searchParams.get('token')||'';
  if(token.length<20) return NextResponse.json({error:'Poziv nije ispravan.'},{status:400});
  const admin=createAdminClient();
  const tokenHash=await hashInviteToken(token);
  const {data:invite}=await admin.from('client_invitations')
    .select('id,company_id,company_name,company_pib,company_registration_number,email,phone,status,expires_at,accounting_organization_id')
    .eq('token_hash',tokenHash).maybeSingle();
  if(!invite) return NextResponse.json({error:'Poziv nije pronađen.'},{status:404});
  if(invite.status!=='pending') return NextResponse.json({error:'Ovaj poziv više nije aktivan.'},{status:410});
  if(new Date(invite.expires_at).getTime()<Date.now()) return NextResponse.json({error:'Poziv je istekao.'},{status:410});
  const [{data:office},{data:company}]=await Promise.all([admin.from('organizations').select('name').eq('id',invite.accounting_organization_id).maybeSingle(),invite.company_id?admin.from('companies').select('name,pib,registration_number').eq('id',invite.company_id).maybeSingle():Promise.resolve({data:null} as any)]);
  return NextResponse.json({ok:true,company_name:company?.name||invite.company_name,pib:company?.pib||invite.company_pib,registration_number:company?.registration_number||invite.company_registration_number,email:invite.email,phone:invite.phone,accounting_office:office?.name||'Knjigovodstvena agencija'});
}
