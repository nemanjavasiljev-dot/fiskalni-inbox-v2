import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { allowedMessageRecipients } from "@/lib/message-access";
import { sendPushToUserIds } from "@/lib/push-delivery";

export const dynamic="force-dynamic";
export const revalidate=0;

export async function GET(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Niste prijavljeni."},{status:401});
  const admin=createAdminClient();
  const [{data:rows,error},recipients]=await Promise.all([
    admin.from("user_messages").select("id,sender_user_id,recipient_user_id,organization_id,subject,body,parent_message_id,read_at,deleted_by_sender_at,deleted_by_recipient_at,created_at").or(`sender_user_id.eq.${user.id},recipient_user_id.eq.${user.id}`).order("created_at",{ascending:false}).limit(500),
    allowedMessageRecipients(admin,user.id)
  ]);
  if(error)return NextResponse.json({error:error.message},{status:500});
  const items=(rows||[]).filter((m:any)=>String(m.sender_user_id)===String(user.id)?!m.deleted_by_sender_at:!m.deleted_by_recipient_at);
  const ids=Array.from(new Set(items.flatMap((m:any)=>[String(m.sender_user_id),String(m.recipient_user_id)])));
  const {data:profiles}=ids.length?await admin.from("profiles").select("user_id,username,full_name,auth_email,global_role").in("user_id",ids):{data:[] as any[]};
  const profileMap=new Map((profiles||[]).map((p:any)=>[String(p.user_id),p]));
  const enriched=items.map((m:any)=>({
    ...m,
    sender:profileMap.get(String(m.sender_user_id))||null,
    recipient:profileMap.get(String(m.recipient_user_id))||null,
    direction:String(m.sender_user_id)===String(user.id)?"sent":"received"
  }));
  return NextResponse.json({ok:true,items:enriched,recipients,current_user_id:user.id},{headers:{"Cache-Control":"private, no-store, max-age=0"}});
}

export async function POST(request:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Niste prijavljeni."},{status:401});
  const body=await request.json().catch(()=>({}));
  const recipientId=String(body?.recipient_user_id||"");
  const subject=String(body?.subject||"Poruka").trim().slice(0,160);
  const message=String(body?.body||"").trim().slice(0,8000);
  const parentId=body?.parent_message_id?String(body.parent_message_id):null;
  if(!recipientId||!message)return NextResponse.json({error:"Izaberite primaoca i unesite poruku."},{status:400});
  const admin=createAdminClient();
  const recipients=await allowedMessageRecipients(admin,user.id);
  if(!recipients.some((r:any)=>String(r.user_id)===recipientId))return NextResponse.json({error:"Nemate dozvolu da pošaljete poruku tom primaocu."},{status:403});
  const {data:senderProfile}=await admin.from("profiles").select("full_name,username,auth_email").eq("user_id",user.id).maybeSingle();
  const {data,error}=await admin.from("user_messages").insert({sender_user_id:user.id,recipient_user_id:recipientId,subject:subject||"Poruka",body:message,parent_message_id:parentId}).select("*").single();
  if(error)return NextResponse.json({error:error.message},{status:500});
  const senderName=senderProfile?.full_name||senderProfile?.username||senderProfile?.auth_email||"FiscalBox korisnik";
  await sendPushToUserIds(admin,[recipientId],{title:`Nova poruka · ${senderName}`,body:subject||message.slice(0,100),url:"/app/messages",tag:`message-${data.id}`,notificationType:"message"});
  return NextResponse.json({ok:true,item:data});
}
