import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic="force-dynamic";
export const revalidate=0;

export async function GET(request:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Niste prijavljeni."},{status:401});
  const url=new URL(request.url);
  const limit=Math.max(1,Math.min(200,Number(url.searchParams.get("limit")||100)));
  const {data,error}=await supabase.from("user_notifications")
    .select("id,event_key,tag,notification_type,title,body,url,organization_id,read_at,reaction,reacted_at,created_at")
    .eq("user_id",user.id)
    .is("deleted_at",null)
    .order("created_at",{ascending:false})
    .limit(limit);
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({ok:true,items:data||[]},{headers:{"Cache-Control":"private, no-store, max-age=0"}});
}
