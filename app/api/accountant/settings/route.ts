import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request:Request){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:'Niste prijavljeni.'},{status:401});
  const body=await request.json();const officeId=String(body.accounting_organization_id||'');
  const {data:membership}=await supabase.from('organization_members').select('role,organizations(organization_type)').eq('organization_id',officeId).eq('user_id',user.id).maybeSingle();
  if(!membership||(membership as any).organizations?.organization_type!=='accounting')return NextResponse.json({error:'Nemate pristup podešavanjima agencije.'},{status:403});
  const payload={user_id:user.id,accounting_organization_id:officeId,notify_new_receipts:body.notify_new_receipts!==false,notify_new_documents:body.notify_new_documents!==false,notify_deadlines:body.notify_deadlines!==false,updated_at:new Date().toISOString()};
  const {data,error}=await supabase.from('accountant_user_settings').upsert(payload,{onConflict:'user_id,accounting_organization_id'}).select('*').single();
  if(error)return NextResponse.json({error:error.message},{status:400});return NextResponse.json({ok:true,settings:data});
}
