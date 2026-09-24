"use client";
import { BellRing } from "lucide-react";
import React from "react";

function urlBase64ToUint8Array(base64String:string){
  const padding='='.repeat((4-base64String.length%4)%4);
  const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(base64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}

export default function PushNotificationOptIn(){
  const [state,setState]=React.useState<"idle"|"busy"|"done"|"unsupported"|"unconfigured"|"denied">("idle");

  const ensureSubscription=React.useCallback(async(requestPermission:boolean)=>{
    if(typeof window==='undefined'||!("serviceWorker" in navigator)||!("PushManager" in window)){setState("unsupported");return false;}
    setState("busy");
    try{
      const keyResp=await fetch('/api/push/public-key',{cache:'no-store'});
      const keyData=await keyResp.json();
      if(!keyData?.configured||!keyData?.publicKey){setState("unconfigured");return false;}
      let permission=Notification.permission;
      if(permission==='default'&&requestPermission)permission=await Notification.requestPermission();
      if(permission==='denied'){setState("denied");return false;}
      if(permission!=='granted'){setState("idle");return false;}
      const reg=await navigator.serviceWorker.ready;
      let sub=await reg.pushManager.getSubscription();
      if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(keyData.publicKey)});
      const r=await fetch('/api/push/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(sub.toJSON())});
      setState(r.ok?"done":"idle");
      return r.ok;
    }catch{setState("idle");return false;}
  },[]);

  React.useEffect(()=>{
    if(typeof window==='undefined'||!("serviceWorker" in navigator)||!("PushManager" in window)){setState("unsupported");return;}
    // Ako je korisnik ranije dao dozvolu, FiscalBox sam obnavlja pretplatu pri svakom otvaranju.
    if(Notification.permission==='granted')ensureSubscription(false);
    else if(Notification.permission==='denied')setState("denied");
  },[ensureSubscription]);

  if(state==="unsupported")return null;
  const label=state==="busy"?"Uključujem…":state==="done"?"Windows obaveštenja aktivna":state==="unconfigured"?"Push nije podešen":state==="denied"?"Obaveštenja blokirana":"Uključi Windows obaveštenja";
  return <button type="button" className="btn push-optin" onClick={()=>ensureSubscription(true)} disabled={state==="busy"||state==="done"} title={state==="unconfigured"?"Dodajte VAPID ključeve u Vercel":state==="denied"?"Dozvolite obaveštenja za FiscalBox u podešavanjima browsera/Windows-a":undefined}><BellRing size={15}/>{label}</button>;
}
