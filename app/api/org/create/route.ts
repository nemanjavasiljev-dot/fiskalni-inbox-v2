import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Niste prijavljeni."},{status:401});
  const {name,pib,plan}=await request.json();
  const selected=plan==="premium"?"premium":"basic";
  const {data:org,error}=await supabase.from("organizations").insert({
    name:String(name||"").trim(),pib:String(pib||"").trim()||null,owner_user_id:user.id,plan:selected
  }).select("id").single();
  if(error)return NextResponse.json({error:error.message},{status:400});
  const {error:memberError}=await supabase.from("organization_members").insert({
    organization_id:org.id,user_id:user.id,role:"owner"
  });
  if(memberError)return NextResponse.json({error:memberError.message},{status:400});
  await supabase.from("subscriptions").insert({organization_id:org.id,plan:selected,seat_count:1,status:"trial"});
  return NextResponse.json({id:org.id});
}
