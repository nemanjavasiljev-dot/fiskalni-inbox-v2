import webpush from "web-push";

let configured = false;
export function configureWebPush(){
  const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey=process.env.VAPID_PRIVATE_KEY;
  const subject=process.env.VAPID_SUBJECT || "mailto:admin@fiscalbox.rs";
  if(!publicKey||!privateKey)return false;
  if(!configured){webpush.setVapidDetails(subject,publicKey,privateKey);configured=true;}
  return true;
}

export async function sendWebPush(subscription:{endpoint:string;p256dh:string;auth_key:string},payload:{title:string;body:string;url?:string}){
  if(!configureWebPush())return {sent:false,configured:false};
  try{
    await webpush.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth_key}},JSON.stringify(payload));
    return {sent:true,configured:true};
  }catch(error:any){
    return {sent:false,configured:true,status:Number(error?.statusCode||0),expired:[404,410].includes(Number(error?.statusCode||0))};
  }
}
