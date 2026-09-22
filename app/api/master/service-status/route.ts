import { NextResponse } from "next/server";
import { requireMaster } from "@/lib/master-auth";

function serviceStatus(sub:any){
  if(!sub) return "pending_payment";
  if(sub.status==="trial"&&sub.trial_ends_at&&new Date(sub.trial_ends_at).getTime()>Date.now()) return "trial";
  if(sub.provider==="lemonsqueezy"&&sub.provider_subscription_id){
    if(["active","paused","past_due"].includes(String(sub.status))) return "active";
    if(sub.status==="cancelled"&&new Date(sub.ends_at||sub.current_period_end||0).getTime()>Date.now()) return "active";
  }
  return "pending_payment";
}

export async function POST(request:Request){
  const ctx=await requireMaster();if(!ctx.ok)return NextResponse.json({error:ctx.error},{status:ctx.status});
  const {organization_id,action,reason}=await request.json();
  if(!organization_id||!["activate","block"].includes(action))return NextResponse.json({error:"Neispravan zahtev."},{status:400});
  let update:any;
  if(action==="block"){
    update={status:"paused",service_block_reason:String(reason||"Blokirano od strane master administratora."),service_blocked_at:new Date().toISOString()};
  } else {
    const {data:sub}=await ctx.admin.from("subscriptions").select("*").eq("organization_id",organization_id).maybeSingle();
    update={status:serviceStatus(sub),service_block_reason:null,service_blocked_at:null};
  }
  const {error}=await ctx.admin.from("organizations").update(update).eq("id",organization_id);if(error)return NextResponse.json({error:error.message},{status:400});
  await ctx.admin.from("master_action_log").insert({action:`service_${action}`,organization_id,details:{reason:reason||null,result_status:update.status},created_by:ctx.user.id});
  return NextResponse.json({ok:true,status:update.status});
}
