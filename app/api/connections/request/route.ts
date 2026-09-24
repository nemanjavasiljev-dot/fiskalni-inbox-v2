import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createConnectionRequest } from '@/lib/connection-requests';

export async function POST(request:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:'Niste prijavljeni.'},{status:401});
  const body=await request.json().catch(()=>({}));
  const organizationId=String(body.organization_id||'');
  const channel=body.channel==='sms'?'sms':'email';
  const contact=String(body.contact||'').trim();
  if(!organizationId)return NextResponse.json({error:'Nedostaje organizacija koja šalje zahtev.'},{status:400});
  const {data:membership}=await supabase.from('organization_members').select('role,accounting_access_role').eq('organization_id',organizationId).eq('user_id',user.id).maybeSingle();
  if(!membership||!(membership.role==='owner'||(membership.role==='employee'&&membership.accounting_access_role==='admin')))return NextResponse.json({error:'Nemate pravo slanja zahteva iz ove organizacije.'},{status:403});
  const admin=createAdminClient();
  try{
    const result=await createConnectionRequest({admin,requestUrl:request.url,senderOrganizationId:organizationId,senderUserId:user.id,channel,contact});
    return NextResponse.json({ok:true,...result,message:`Zahtev je poslat putem ${channel==='email'?'emaila':'SMS-a'}. Primalac ga prihvata u svom FiscalBox dashboardu.`});
  }catch(e:any){
    return NextResponse.json({error:e?.message||'Zahtev nije poslat.'},{status:400});
  }
}
