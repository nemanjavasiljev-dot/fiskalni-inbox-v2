import webpush from "web-push";

let configured = false;
export function configureWebPush(){
  const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey=process.env.VAPID_PRIVATE_KEY;
  const subject=process.env.VAPID_SUBJECT || "mailto:noreply@fiscalbox.rs";
  if(!publicKey||!privateKey)return false;
  if(!configured){webpush.setVapidDetails(subject,publicKey,privateKey);configured=true;}
  return true;
}

export type WebPushPayload={
  title:string;
  body:string;
  url?:string;
  tag?:string;
  eventKey?:string;
};

export async function sendWebPush(subscription:{endpoint:string;p256dh:string;auth_key:string},payload:WebPushPayload){
  if(!configureWebPush())return {sent:false,configured:false};
  try{
    await webpush.sendNotification(
      {endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth_key}},
      JSON.stringify(payload),
      {TTL:60*60,urgency:"high"}
    );
    return {sent:true,configured:true};
  }catch(error:any){
    const status=Number(error?.statusCode||0);
    console.error("FiscalBox push send failed",{status,body:String(error?.body||"").slice(0,300)});
    return {sent:false,configured:true,status,expired:[404,410].includes(status)};
  }
}
