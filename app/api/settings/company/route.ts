import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request:Request){
  const supabase=await createClient();const admin=createAdminClient();const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:'Niste prijavljeni.'},{status:401});
  const body=await request.json();const orgId=String(body.organization_id||'');
  if(!orgId)return NextResponse.json({error:'Nedostaje kompanija.'},{status:400});
  const {data:membership}=await supabase.from('organization_members').select('role').eq('organization_id',orgId).eq('user_id',user.id).maybeSingle();
  if(!membership||!['owner','employee'].includes(String(membership.role)))return NextResponse.json({error:'Nemate pravo da menjate ovu kompaniju.'},{status:403});
  const contact_email=String(body.contact_email||'').trim()||null;const contact_phone=String(body.contact_phone||'').trim()||null;
  const {error}=await admin.from('organizations').update({contact_email,contact_phone}).eq('id',orgId);
  if(error)return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({ok:true});
}
