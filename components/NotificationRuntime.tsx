"use client";

import React from "react";
import { Bell, X } from "lucide-react";

type ToastData={title:string;body:string;url?:string;id:number};

export default function NotificationRuntime(){
  const [toast,setToast]=React.useState<ToastData|null>(null);
  const timer=React.useRef<ReturnType<typeof setTimeout>|null>(null);

  React.useEffect(()=>{
    if(!("serviceWorker" in navigator))return;
    const onMessage=(event:MessageEvent)=>{
      const msg=event.data;
      if(msg?.type!=="fiscalbox:push")return;
      const payload=msg.payload||{};
      if(timer.current)clearTimeout(timer.current);
      const next={title:String(payload.title||"FiscalBox"),body:String(payload.body||"Imate novo obaveštenje."),url:String(payload.url||"/app"),id:Date.now()};
      setToast(next);
      timer.current=setTimeout(()=>setToast(null),5000);
    };
    navigator.serviceWorker.addEventListener("message",onMessage);
    return()=>{
      navigator.serviceWorker.removeEventListener("message",onMessage);
      if(timer.current)clearTimeout(timer.current);
    };
  },[]);

  if(!toast)return null;
  return <aside className="fiscalbox-live-toast" role="status" aria-live="polite">
    <button className="fiscalbox-live-toast-close" aria-label="Zatvori" onClick={()=>setToast(null)}><X size={14}/></button>
    <div className="fiscalbox-live-toast-icon"><Bell size={21}/></div>
    <div className="fiscalbox-live-toast-copy">
      <b>{toast.title}</b>
      <p>{toast.body}</p>
    </div>
    {toast.url&&<a href={toast.url} className="fiscalbox-live-toast-open">Otvori</a>}
  </aside>;
}
