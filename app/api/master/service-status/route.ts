import { NextResponse } from "next/server";
import { requireMaster } from "@/lib/master-auth";
export async function POST(request:Request){
  const ctx=await requireMaster();if(!ctx.ok)return NextResponse.json({error:ctx.error},{status:ctx.status});
  const {organization_id,action,reason}=await request.json();
  if(!organization_id||!["activate","block"].includes(action))return NextResponse.json({error:"Neispravan zahtev."},{status:400});
  const update=action==="block"?{status:"paused",service_block_reason:String(reason||"Blokirano od strane master administratora."),service_blocked_at:new Date().toISOString()}:{status:"active",service_block_reason:null,service_blocked_at:null};
  const {error}=await ctx.admin.from("organizations").update(update).eq("id",organization_id);if(error)return NextResponse.json({error:error.message},{status:400});
  await ctx.admin.from("subscriptions").update({status:action==="block"?"past_due":"active"}).eq("organization_id",organization_id);
  await ctx.admin.from("master_action_log").insert({action:`service_${action}`,organization_id,details:{reason:reason||null},created_by:ctx.user.id});
  return NextResponse.json({ok:true,status:update.status});
}
