"use client";
import React from "react";
import { Bell, Mail } from "lucide-react";

export default function CommunicationQuickActions({className="",compact=false}:{className?:string;compact?:boolean}){
  const [counts,setCounts]=React.useState({notifications:0,messages:0});
  React.useEffect(()=>{
    let active=true;let timer:any;
    const load=async()=>{try{const r=await fetch("/api/communication/counts",{cache:"no-store"});const d=await r.json();if(active&&r.ok)setCounts({notifications:Number(d.notifications||0),messages:Number(d.messages||0)});}catch{}finally{if(active)timer=setTimeout(load,5000);}};
    load();return()=>{active=false;if(timer)clearTimeout(timer)};
  },[]);
  const badge=(n:number)=>n>0?<span>{n>99?"99+":n}</span>:null;
  return <div className={`communication-quick-actions ${compact?"compact":""} ${className}`.trim()}>
    <a href="/app/messages" aria-label={`Poruke${counts.messages?` (${counts.messages} nepročitanih)`:""}`} title="Poruke"><Mail size={compact?18:20}/>{badge(counts.messages)}</a>
    <a href="/app/notifications" aria-label={`Notifikacije${counts.notifications?` (${counts.notifications} nepročitanih)`:""}`} title="Notifikacije"><Bell size={compact?18:20}/>{badge(counts.notifications)}</a>
  </div>;
}
