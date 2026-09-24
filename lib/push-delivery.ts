import { sendWebPush } from "@/lib/web-push";

export type FiscalBoxPushPayload={
  title:string;
  body:string;
  url?:string;
  tag?:string;
  organizationId?:string|null;
  notificationType?:string;
};

function uniqueStrings(values:any[]){
  return Array.from(new Set((values||[]).map(v=>String(v||"")).filter(Boolean)));
}

export async function sendPushToUserIds(admin:any,userIds:string[],payload:FiscalBoxPushPayload){
  const ids=uniqueStrings(userIds);
  const configured=Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY);
  if(!ids.length)return {sent:0,subscriptions:0,configured,persisted:0};

  const eventKey=`${payload.tag||"fiscalbox"}:${Date.now()}:${crypto.randomUUID()}`;
  const rows=ids.map(userId=>({
    user_id:userId,
    organization_id:payload.organizationId||null,
    event_key:eventKey,
    tag:payload.tag||"fiscalbox",
    notification_type:payload.notificationType||"system",
    title:payload.title,
    body:payload.body,
    url:payload.url||"/app"
  }));
  let persisted=0;
  try{
    const {data}=await admin.from("user_notifications").insert(rows).select("id");
    persisted=(data||[]).length;
  }catch{}

  const {data:subs,error}=await admin.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth_key").in("user_id",ids);
  if(error)return {sent:0,subscriptions:0,configured,persisted,error:error.message};
  let sent=0;
  for(const sub of subs||[]){
    const result=await sendWebPush(sub,{...payload,eventKey});
    if(result.sent)sent++;
    if(result.expired)await admin.from("push_subscriptions").delete().eq("id",sub.id);
  }
  return {sent,subscriptions:(subs||[]).length,configured,persisted,eventKey};
}

export async function organizationUserIds(admin:any,organizationId:string){
  const [{data:members},{data:org}]=await Promise.all([
    admin.from("organization_members").select("user_id,role").eq("organization_id",organizationId).in("role",["owner","employee"]),
    admin.from("organizations").select("owner_user_id").eq("id",organizationId).maybeSingle()
  ]);
  return uniqueStrings([...(members||[]).map((m:any)=>m.user_id),org?.owner_user_id]);
}

export async function sendPushToOrganization(admin:any,organizationId:string,payload:FiscalBoxPushPayload){
  const userIds=await organizationUserIds(admin,organizationId);
  return sendPushToUserIds(admin,userIds,{...payload,organizationId:payload.organizationId||organizationId});
}

export async function accountantUserIdsForClient(admin:any,clientOrganizationId:string){
  const ids:string[]=[];
  const {data:links}=await admin.from("accountant_company")
    .select("accountant_organization_id")
    .eq("client_organization_id",clientOrganizationId)
    .eq("status","active");
  for(const link of links||[]){
    ids.push(...await organizationUserIds(admin,String(link.accountant_organization_id)));
  }
  const {data:legacy}=await admin.from("organization_members")
    .select("user_id")
    .eq("organization_id",clientOrganizationId)
    .eq("role","accountant");
  ids.push(...(legacy||[]).map((m:any)=>String(m.user_id)));
  return uniqueStrings(ids);
}

export async function sendPushToAccountantsForClient(admin:any,clientOrganizationId:string,payload:FiscalBoxPushPayload){
  const userIds=await accountantUserIdsForClient(admin,clientOrganizationId);
  return sendPushToUserIds(admin,userIds,{...payload,organizationId:payload.organizationId||clientOrganizationId});
}
