import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Niste prijavljeni."},{status:401});
  const body=await request.json();
  const name=String(body.name||"").trim();
  if(!name)return NextResponse.json({error:"Naziv firme je obavezan."},{status:400});
  const selected=["trial","basic","premium"].includes(body.plan)?body.plan:"trial";
  const {data:org,error}=await supabase.from("organizations").insert({
    name,
    pib:String(body.pib||"").trim()||null,
    registration_number:String(body.registration_number||"").trim()||null,
    legal_form:String(body.legal_form||"").trim()||null,
    address:String(body.address||"").trim()||null,
    municipality:String(body.municipality||"").trim()||null,
    activity_code:String(body.activity_code||"").trim()||null,
    activity_name:String(body.activity_name||"").trim()||null,
    apr_raw:body.apr_raw||null,
    owner_user_id:user.id,
    plan:selected,
    status:selected==="trial"?"trial":"active",
    organization_type:"company",
    trial_ends_at:selected==="trial"?new Date(Date.now()+10*24*60*60*1000).toISOString():null
  }).select("id").single();
  if(error)return NextResponse.json({error:error.message},{status:400});
  const {error:memberError}=await supabase.from("organization_members").insert({organization_id:org.id,user_id:user.id,role:"owner"});
  if(memberError)return NextResponse.json({error:memberError.message},{status:400});
  const trialEnd=selected==="trial"?new Date(Date.now()+10*24*60*60*1000).toISOString():null;
  await supabase.from("subscriptions").insert({organization_id:org.id,plan:selected,seat_count:1,status:selected==="trial"?"trial":"active",trial_started_at:selected==="trial"?new Date().toISOString():null,trial_ends_at:trialEnd,current_period_end:trialEnd});
  return NextResponse.json({id:org.id});
}
