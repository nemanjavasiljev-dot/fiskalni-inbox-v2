import { sendWebPush } from "@/lib/web-push";

export type FiscalBoxPushPayload={
  title:string;
  body:string;
  url?:string;
  tag?:string;
};

function uniqueStrings(values:any[]){
  return Array.from(new Set((values||[]).map(v=>String(v||"")).filter(Boolean)));
}

export async function sendPushToUserIds(admin:any,userIds:string[],payload:FiscalBoxPushPayload){
  const ids=uniqueStrings(userIds);
  if(!ids.length)return {sent:0,subscriptions:0,configured:Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY)};
  const {data:subs,error}=await admin.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth_key").in("user_id",ids);
  if(error)return {sent:0,subscriptions:0,configured:false,error:error.message};
  let sent=0;
  for(const sub of subs||[]){
    const result=await sendWebPush(sub,payload);
    if(result.sent)sent++;
    if(result.expired)await admin.from("push_subscriptions").delete().eq("id",sub.id);
  }
  return {sent,subscriptions:(subs||[]).length,configured:Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY)};
}

export async function organizationUserIds(admin:any,organizationId:string){
  const [{data:members},{data:org}]=await Promise.all([
    admin.from("organization_members").select("user_id").eq("organization_id",organizationId),
    admin.from("organizations").select("owner_user_id").eq("id",organizationId).maybeSingle()
  ]);
  return uniqueStrings([...(members||[]).map((m:any)=>m.user_id),org?.owner_user_id]);
}

export async function sendPushToOrganization(admin:any,organizationId:string,payload:FiscalBoxPushPayload){
  const userIds=await organizationUserIds(admin,organizationId);
  return sendPushToUserIds(admin,userIds,payload);
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
  // Backward-compatible direct accountant memberships on the client organization.
  const {data:legacy}=await admin.from("organization_members")
    .select("user_id")
    .eq("organization_id",clientOrganizationId)
    .eq("role","accountant");
  ids.push(...(legacy||[]).map((m:any)=>String(m.user_id)));
  return uniqueStrings(ids);
}

export async function sendPushToAccountantsForClient(admin:any,clientOrganizationId:string,payload:FiscalBoxPushPayload){
  const userIds=await accountantUserIdsForClient(admin,clientOrganizationId);
  return sendPushToUserIds(admin,userIds,payload);
}
