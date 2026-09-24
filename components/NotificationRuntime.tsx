"use client";

import React from "react";
import { Bell, X } from "lucide-react";

type ToastData={title:string;body:string;url?:string;id:number;eventKey?:string;tag?:string};

function rememberEvent(key?:string){
  if(!key||typeof window==="undefined")return;
  try{
    const old=JSON.parse(localStorage.getItem("fiscalbox-notification-events")||"[]") as string[];
    const next=[key,...old.filter(x=>x!==key)].slice(0,80);
    localStorage.setItem("fiscalbox-notification-events",JSON.stringify(next));
  }catch{}
}
function hasSeenEvent(key?:string){
  if(!key||typeof window==="undefined")return false;
  try{return (JSON.parse(localStorage.getItem("fiscalbox-notification-events")||"[]") as string[]).includes(key)}catch{return false}
}

export default function NotificationRuntime(){
  const [toast,setToast]=React.useState<ToastData|null>(null);
  const timer=React.useRef<ReturnType<typeof setTimeout>|null>(null);
  const sinceRef=React.useRef(new Date(Date.now()-5000).toISOString());

  const showToast=React.useCallback((payload:any,showNative=false)=>{
    const eventKey=String(payload?.eventKey||payload?.event_key||"");
    if(eventKey&&hasSeenEvent(eventKey))return;
    if(eventKey)rememberEvent(eventKey);
    if(timer.current)clearTimeout(timer.current);
    const next={title:String(payload?.title||"FiscalBox"),body:String(payload?.body||"Imate novo obaveštenje."),url:String(payload?.url||"/app"),id:Date.now(),eventKey,tag:String(payload?.tag||"fiscalbox")};
    setToast(next);
    timer.current=setTimeout(()=>setToast(null),5000);

    if(showNative&&typeof Notification!=="undefined"&&Notification.permission==="granted"&&"serviceWorker" in navigator){
      navigator.serviceWorker.ready.then(reg=>reg.showNotification(next.title,{
        body:next.body,icon:"/icons/icon-192.png",badge:"/icons/icon-192.png",tag:next.tag||eventKey||"fiscalbox",renotify:true,data:{url:next.url,eventKey}
      })).catch(()=>{});
    }
  },[]);

  React.useEffect(()=>{
    if(!("serviceWorker" in navigator))return;
    const onMessage=(event:MessageEvent)=>{
      const msg=event.data;if(msg?.type!=="fiscalbox:push")return;
      showToast(msg.payload||{},false);
    };
    navigator.serviceWorker.addEventListener("message",onMessage);
    return()=>navigator.serviceWorker.removeEventListener("message",onMessage);
  },[showToast]);

  React.useEffect(()=>{
    let stopped=false;
    async function poll(){
      if(stopped)return;
      try{
        const since=sinceRef.current;
        const response=await fetch(`/api/notifications/poll?since=${encodeURIComponent(since)}`,{cache:"no-store",headers:{"Cache-Control":"no-cache"}});
        if(response.status===401){stopped=true;return;}
        const data=await response.json().catch(()=>({}));
        if(stopped)return;
        sinceRef.current=String(data.checked_at||new Date().toISOString());
        const items=Array.isArray(data.items)?data.items:[];
        for(const item of items)showToast(item,true);
      }catch{}
    }
    void poll();
    const interval=window.setInterval(()=>void poll(),5000);
    return()=>{stopped=true;window.clearInterval(interval);if(timer.current)clearTimeout(timer.current)};
  },[showToast]);

  if(!toast)return null;
  return <aside className="fiscalbox-live-toast" role="status" aria-live="polite">
    <button className="fiscalbox-live-toast-close" aria-label="Zatvori" onClick={()=>setToast(null)}><X size={14}/></button>
    <div className="fiscalbox-live-toast-icon"><Bell size={21}/></div>
    <div className="fiscalbox-live-toast-copy"><b>{toast.title}</b><p>{toast.body}</p></div>
    {toast.url&&<a href={toast.url} className="fiscalbox-live-toast-open">Otvori</a>}
  </aside>;
}
