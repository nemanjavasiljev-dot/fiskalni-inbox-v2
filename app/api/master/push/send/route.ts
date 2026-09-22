import { NextResponse } from "next/server";
import { requireMaster } from "@/lib/master-auth";
import { sendWebPush } from "@/lib/web-push";
export async function POST(request:Request){
  const ctx=await requireMaster();if(!ctx.ok)return NextResponse.json({error:ctx.error},{status:ctx.status});
  const {organization_ids,title,message,url}=await request.json();const ids=Array.isArray(organization_ids)?organization_ids.map(String):[];
  if(!ids.length||!title||!message)return NextResponse.json({error:"Izaberite primaoce i unesite push poruku."},{status:400});
  const {data:members}=await ctx.admin.from("organization_members").select("organization_id,user_id,role").in("organization_id",ids);const userIds=Array.from(new Set((members||[]).filter((m:any)=>["owner","employee"].includes(m.role)).map((m:any)=>String(m.user_id))));const {data:subs}=userIds.length?await ctx.admin.from("push_subscriptions").select("*").in("user_id",userIds):{data:[] as any[]};
  let sent=0;let configured=Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY);for(const s of subs||[]){const r=await sendWebPush(s,{title:String(title),body:String(message),url:String(url||'/app')});if(r.sent)sent++;if(r.expired)await ctx.admin.from("push_subscriptions").delete().eq("id",s.id);}
  await ctx.admin.from("master_notification_log").insert({channel:"push",target_organization_ids:ids,subject:String(title),body:String(message),recipient_count:(subs||[]).length,sent_count:sent,created_by:ctx.user.id});
  return NextResponse.json({ok:true,recipient_count:(subs||[]).length,sent_count:sent,configured});
}
