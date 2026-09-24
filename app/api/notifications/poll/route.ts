import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic="force-dynamic";
export const revalidate=0;

export async function GET(request:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Niste prijavljeni."},{status:401});
  const url=new URL(request.url);
  const sinceRaw=url.searchParams.get("since");
  const fallback=new Date(Date.now()-15000).toISOString();
  const since=sinceRaw&&Number.isFinite(new Date(sinceRaw).getTime())?new Date(sinceRaw).toISOString():fallback;
  const {data,error}=await supabase.from("user_notifications")
    .select("id,event_key,tag,notification_type,title,body,url,organization_id,created_at")
    .gt("created_at",since)
    .order("created_at",{ascending:true})
    .limit(25);
  if(error){
    // Pre SQL_024 aplikacija i dalje radi; samo nema polling fallback.
    return NextResponse.json({ok:true,items:[],checked_at:new Date().toISOString(),warning:error.message},{headers:{"Cache-Control":"private, no-store"}});
  }
  return NextResponse.json({ok:true,items:data||[],checked_at:new Date().toISOString()},{headers:{"Cache-Control":"private, no-store, max-age=0"}});
}
