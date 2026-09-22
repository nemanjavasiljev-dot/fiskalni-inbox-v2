"use client";
import { BellRing } from "lucide-react";
import React from "react";

function urlBase64ToUint8Array(base64String:string){
  const padding='='.repeat((4-base64String.length%4)%4);
  const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(base64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}

export default function PushNotificationOptIn(){
  const [state,setState]=React.useState<"idle"|"busy"|"done"|"unsupported"|"unconfigured">("idle");
  React.useEffect(()=>{if(typeof window==='undefined'||!("serviceWorker" in navigator)||!("PushManager" in window))setState("unsupported");},[]);
  async function enable(){
    setState("busy");
    try{
      const keyResp=await fetch('/api/push/public-key',{cache:'no-store'});const keyData=await keyResp.json();
      if(!keyData?.configured||!keyData?.publicKey){setState("unconfigured");return;}
      const permission=await Notification.requestPermission();if(permission!=="granted"){setState("idle");return;}
      const reg=await navigator.serviceWorker.ready;
      let sub=await reg.pushManager.getSubscription();
      if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(keyData.publicKey)});
      const r=await fetch('/api/push/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(sub.toJSON())});
      setState(r.ok?"done":"idle");
    }catch{setState("idle");}
  }
  if(state==="unsupported")return null;
  return <button type="button" className="btn push-optin" onClick={enable} disabled={state==="busy"||state==="done"} title={state==="unconfigured"?"Push servis još nije konfigurisan":undefined}><BellRing size={15}/>{state==="busy"?"Uključujem…":state==="done"?"Push uključen":state==="unconfigured"?"Push nije podešen":"Uključi push"}</button>;
}
