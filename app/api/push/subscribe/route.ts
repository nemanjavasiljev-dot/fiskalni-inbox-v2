import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Niste prijavljeni."},{status:401});
  const body=await request.json();
  const endpoint=String(body?.endpoint||"");const p256dh=String(body?.keys?.p256dh||"");const authKey=String(body?.keys?.auth||"");
  if(!endpoint||!p256dh||!authKey)return NextResponse.json({error:"Neispravna push pretplata."},{status:400});
  const {error}=await supabase.from("push_subscriptions").upsert({user_id:user.id,endpoint,p256dh,auth_key:authKey,user_agent:request.headers.get("user-agent")||null,updated_at:new Date().toISOString()},{onConflict:"endpoint"});
  if(error)return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({ok:true});
}
