"use client";
import { BellRing } from "lucide-react";
import React from "react";

function urlBase64ToUint8Array(base64String:string){
  const padding='='.repeat((4-base64String.length%4)%4);
  const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(base64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}
function sameKey(a:ArrayBuffer|null,b:Uint8Array){
  if(!a)return false;const aa=new Uint8Array(a);if(aa.length!==b.length)return false;
  for(let i=0;i<aa.length;i++)if(aa[i]!==b[i])return false;return true;
}
function isIos(){return typeof navigator!=="undefined"&&/iPad|iPhone|iPod/.test(navigator.userAgent)}
function isStandalone(){
  if(typeof window==="undefined")return false;
  return window.matchMedia?.("(display-mode: standalone)").matches||Boolean((navigator as any).standalone);
}

export default function PushNotificationOptIn(){
  const [state,setState]=React.useState<"idle"|"busy"|"done"|"unsupported"|"unconfigured"|"denied"|"install_required"|"error">("idle");
  const [detail,setDetail]=React.useState("");

  const ensureSubscription=React.useCallback(async(requestPermission:boolean)=>{
    if(typeof window==='undefined'||!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window)){setState("unsupported");return false;}
    if(isIos()&&!isStandalone()){
      setState("install_required");setDetail("Na iPhone/iPad uređaju push radi iz FiscalBox aplikacije dodate na početni ekran.");return false;
    }
    setState("busy");setDetail("");
    try{
      const keyResp=await fetch('/api/push/public-key',{cache:'no-store'});
      const keyData=await keyResp.json();
      if(!keyData?.configured||!keyData?.publicKey){setState("unconfigured");setDetail("Dodajte VAPID ključeve u Vercel Environment Variables.");return false;}
      let permission=Notification.permission;
      if(permission==='default'&&requestPermission)permission=await Notification.requestPermission();
      if(permission==='denied'){setState("denied");setDetail("Dozvolite obaveštenja za FiscalBox u podešavanjima browsera/Windows-a.");return false;}
      if(permission!=='granted'){setState("idle");return false;}
      const reg=await navigator.serviceWorker.ready;
      const wantedKey=urlBase64ToUint8Array(String(keyData.publicKey));
      let sub=await reg.pushManager.getSubscription();
      if(sub&&!sameKey(sub.options.applicationServerKey,wantedKey)){
        await sub.unsubscribe().catch(()=>false);
        sub=null;
      }
      if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:wantedKey});
      const r=await fetch('/api/push/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(sub.toJSON())});
      const saved=await r.json().catch(()=>({}));
      if(!r.ok){setState("error");setDetail(saved.error||"Push pretplata nije sačuvana.");return false;}
      setState("done");
      if(requestPermission){
        const test=await fetch('/api/push/test',{method:'POST'});
        const testData=await test.json().catch(()=>({}));
        if(!test.ok)setDetail(testData.error||"Pretplata je aktivna, ali test obaveštenje nije poslato.");
        else setDetail("Test obaveštenje je poslato. Push je aktivan na ovom uređaju.");
      }
      return true;
    }catch(e:any){setState("error");setDetail(e?.message||"Push trenutno nije mogao da se aktivira.");return false;}
  },[]);

  React.useEffect(()=>{
    if(typeof window==='undefined'||!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window)){setState("unsupported");return;}
    if(isIos()&&!isStandalone()){setState("install_required");return;}
    if(Notification.permission==='granted')ensureSubscription(false);
    else if(Notification.permission==='denied')setState("denied");
  },[ensureSubscription]);

  if(state==="unsupported")return null;
  const label=state==="busy"?"Uključujem…":state==="done"?"Obaveštenja aktivna":state==="unconfigured"?"Push nije podešen":state==="denied"?"Obaveštenja blokirana":state==="install_required"?"Instaliraj za push":state==="error"?"Pokušaj ponovo":"Uključi obaveštenja";
  const title=detail||undefined;
  return <button type="button" className={`btn push-optin push-state-${state}`} onClick={()=>ensureSubscription(true)} disabled={state==="busy"||state==="done"} title={title}><BellRing size={15}/><span className="push-optin-label">{label}</span></button>;
}
