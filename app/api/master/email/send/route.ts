import { NextResponse } from "next/server";
import { requireMaster } from "@/lib/master-auth";
import { sendCustomMasterEmail } from "@/lib/mailer";
export async function POST(request:Request){
  const ctx=await requireMaster();if(!ctx.ok)return NextResponse.json({error:ctx.error},{status:ctx.status});
  const {organization_ids,subject,message}=await request.json();const ids=Array.isArray(organization_ids)?organization_ids.map(String):[];
  if(!ids.length||!subject||!message)return NextResponse.json({error:"Izaberite primaoce, naslov i poruku."},{status:400});
  const {data:orgs}=await ctx.admin.from("organizations").select("id,company_id,name,contact_email,owner_user_id").in("id",ids);const owners=(orgs||[]).map((o:any)=>o.owner_user_id);const {data:profiles}=owners.length?await ctx.admin.from("profiles").select("user_id,auth_email").in("user_id",owners):{data:[] as any[]};const emailMap=new Map((profiles||[]).map((p:any)=>[String(p.user_id),p.auth_email]));
  let sent=0;const emails=new Set<string>();for(const o of orgs||[]){const to=String(o.contact_email||emailMap.get(String(o.owner_user_id))||"").trim();if(!to||emails.has(to))continue;emails.add(to);const r=await sendCustomMasterEmail({to,subject:String(subject),message:String(message)});if(r.sent)sent++;}
  await ctx.admin.from("master_notification_log").insert({channel:"email",target_organization_ids:ids,target_company_ids:(orgs||[]).map((o:any)=>o.company_id).filter(Boolean),subject:String(subject),body:String(message),recipient_count:emails.size,sent_count:sent,created_by:ctx.user.id});
  return NextResponse.json({ok:true,recipient_count:emails.size,sent_count:sent,configured:Boolean(process.env.RESEND_API_KEY&&process.env.APP_EMAIL_FROM)});
}
