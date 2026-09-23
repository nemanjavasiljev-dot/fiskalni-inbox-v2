import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request:Request){
  const supabase=await createClient();const admin=createAdminClient();const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:'Niste prijavljeni.'},{status:401});
  const body=await request.json();const full_name=String(body.full_name||'').trim()||null;const password=String(body.password||'');
  if(password&&password.length<8)return NextResponse.json({error:'Nova lozinka mora imati najmanje 8 karaktera.'},{status:400});
  const {error:profileError}=await admin.from('profiles').update({full_name}).eq('user_id',user.id);
  if(profileError)return NextResponse.json({error:profileError.message},{status:400});
  if(password){const {error:authError}=await admin.auth.admin.updateUserById(user.id,{password});if(authError)return NextResponse.json({error:authError.message},{status:400});}
  return NextResponse.json({ok:true});
}
