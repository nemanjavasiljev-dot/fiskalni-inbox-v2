import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic="force-dynamic";
export const revalidate=0;

export async function GET(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Niste prijavljeni."},{status:401});
  const admin=createAdminClient();
  const [n,m]=await Promise.all([
    admin.from("user_notifications").select("id",{count:"exact",head:true}).eq("user_id",user.id).is("read_at",null).is("deleted_at",null),
    admin.from("user_messages").select("id",{count:"exact",head:true}).eq("recipient_user_id",user.id).is("read_at",null).is("deleted_by_recipient_at",null)
  ]);
  return NextResponse.json({ok:true,notifications:n.count||0,messages:m.count||0},{headers:{"Cache-Control":"private, no-store, max-age=0"}});
}
