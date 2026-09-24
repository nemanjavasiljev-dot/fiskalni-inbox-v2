import { NextResponse } from "next/server";
import { requireMaster } from "@/lib/master-auth";
import { sendPushToUserIds } from "@/lib/push-delivery";

export async function POST(request:Request){
  const ctx=await requireMaster();if(!ctx.ok)return NextResponse.json({error:ctx.error},{status:ctx.status});
  const {organization_ids,title,message,url}=await request.json();
  const ids=Array.isArray(organization_ids)?organization_ids.map(String):[];
  if(!ids.length||!title||!message)return NextResponse.json({error:"Izaberite primaoce i unesite push poruku."},{status:400});
  const [{data:members},{data:orgs}]=await Promise.all([
    ctx.admin.from("organization_members").select("organization_id,user_id,role").in("organization_id",ids),
    ctx.admin.from("organizations").select("id,company_id").in("id",ids)
  ]);
  const userIds=Array.from(new Set((members||[]).filter((m:any)=>["owner","employee"].includes(m.role)).map((m:any)=>String(m.user_id))));
  const result=await sendPushToUserIds(ctx.admin,userIds,{
    title:String(title),body:String(message),url:String(url||'/app'),tag:`master-${Date.now()}`,notificationType:"master"
  });
  await ctx.admin.from("master_notification_log").insert({
    channel:"push",target_organization_ids:ids,target_company_ids:(orgs||[]).map((o:any)=>o.company_id).filter(Boolean),
    subject:String(title),body:String(message),recipient_count:userIds.length,sent_count:result.sent,created_by:ctx.user.id
  });
  return NextResponse.json({ok:true,recipient_count:userIds.length,sent_count:result.sent,configured:result.configured,persisted:result.persisted});
}
