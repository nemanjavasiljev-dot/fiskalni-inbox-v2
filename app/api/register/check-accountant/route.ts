import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request:Request){
  const {pib}=await request.json();
  const digits=String(pib||'').replace(/\D/g,'');
  if(digits.length!==9) return NextResponse.json({error:'PIB knjigovođe mora imati 9 cifara.'},{status:400});
  const admin=createAdminClient();
  const {data:org}=await admin.from('organizations').select('id,name,pib,owner_user_id,organization_type').eq('pib',digits).limit(1).maybeSingle();
  if(!org) return NextResponse.json({found:false,pib:digits});
  const {data:profile}=await admin.from('profiles').select('user_id,full_name,username,auth_email,global_role').eq('user_id',org.owner_user_id).maybeSingle();
  const isAccountant=org.organization_type==='accounting'||profile?.global_role==='accountant';
  if(!isAccountant) return NextResponse.json({found:false,pib:digits});
  return NextResponse.json({found:true,pib:digits,organization_id:org.id,organization_name:org.name,accountant_name:profile?.full_name||profile?.username||org.name});
}
