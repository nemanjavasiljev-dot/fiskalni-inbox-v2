"use client";

import React from "react";
import { Bell, Check, CheckCheck, ChevronDown, ChevronUp, ExternalLink, Heart, Inbox, Star, Trash2 } from "lucide-react";

const REACTIONS=[
  {id:"received",label:"Primljeno",icon:Check},
  {id:"important",label:"Važno",icon:Star},
  {id:"thanks",label:"Hvala",icon:Heart},
  {id:"done",label:"Završeno",icon:CheckCheck}
] as const;

const dt=(v:any)=>v?new Intl.DateTimeFormat("sr-RS",{dateStyle:"medium",timeStyle:"short"}).format(new Date(v)):"—";

export default function NotificationCenter({initialItems=[]}:{initialItems:any[]}){
  const [items,setItems]=React.useState<any[]>(initialItems);
  const [filter,setFilter]=React.useState<"all"|"unread"|"reacted">("all");
  const [openId,setOpenId]=React.useState<string|null>(null);
  const [busy,setBusy]=React.useState<string|null>(null);
  const [message,setMessage]=React.useState("");

  const visible=items.filter(n=>filter==="unread"?!n.read_at:filter==="reacted"?Boolean(n.reaction):true);
  const unread=items.filter(n=>!n.read_at).length;

  async function action(id:string,payload:any){
    setBusy(id);setMessage("");
    try{
      const r=await fetch(`/api/notifications/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Akcija nije uspela.");
      if(payload.action==="delete"){
        setItems(old=>old.filter(x=>String(x.id)!==String(id)));
        if(openId===id)setOpenId(null);
        setMessage("Notifikacija je obrisana.");
      }else{
        setItems(old=>old.map(x=>String(x.id)===String(id)?{...x,...d.item}:x));
      }
    }catch(e:any){setMessage(e?.message||"Akcija nije uspela.");}
    finally{setBusy(null);}
  }

  async function toggleOpen(n:any){
    const id=String(n.id);const next=openId===id?null:id;setOpenId(next);
    if(next&&!n.read_at)await action(id,{action:"read"});
  }

  return <div className="notification-center">
    <div className="notification-center-toolbar">
      <div className="notification-filter-group">
        <button className={filter==="all"?"active":""} onClick={()=>setFilter("all")}>Sve <span>{items.length}</span></button>
        <button className={filter==="unread"?"active":""} onClick={()=>setFilter("unread")}>Nepročitane <span>{unread}</span></button>
        <button className={filter==="reacted"?"active":""} onClick={()=>setFilter("reacted")}>Reagovane</button>
      </div>
      <div className="notification-center-hint"><Bell size={15}/> Poruke, zahtevi, fajlovi i sistemska obaveštenja</div>
    </div>
    {message&&<div className="home-message">{message}</div>}
    <div className="notification-center-list">
      {visible.map((n:any)=>{
        const open=openId===String(n.id);const reaction=REACTIONS.find(r=>r.id===n.reaction);
        return <article key={n.id} className={`notification-center-card ${n.read_at?"":"unread"} ${open?"open":""}`}>
          <button type="button" className="notification-card-main" onClick={()=>toggleOpen(n)}>
            <span className="notification-card-icon"><Inbox size={20}/>{!n.read_at&&<i/>}</span>
            <span className="notification-card-copy"><small>{String(n.notification_type||"OBAVEŠTENJE").replaceAll("_"," ")}</small><b>{n.title}</b><span>{n.body}</span><em>{dt(n.created_at)}</em></span>
            {reaction&&<span className={`notification-reaction-pill reaction-${reaction.id}`}>{React.createElement(reaction.icon,{size:13})}{reaction.label}</span>}
            <span className="notification-card-chevron">{open?<ChevronUp size={18}/>:<ChevronDown size={18}/>}</span>
          </button>
          {open&&<div className="notification-card-detail">
            <div className="notification-full-message"><b>Poruka</b><p>{n.body}</p></div>
            <div className="notification-reactions"><span>Reaguj:</span>{REACTIONS.map(r=>{const Icon=r.icon;return <button key={r.id} type="button" className={n.reaction===r.id?"active":""} disabled={busy===String(n.id)} onClick={()=>action(String(n.id),{action:"react",reaction:r.id})}><Icon size={15}/>{r.label}</button>})}</div>
            <div className="notification-card-actions">
              {n.url&&<a className="btn btn-primary" href={n.url}><ExternalLink size={15}/> Otvori povezano</a>}
              {n.read_at?<button className="btn" disabled={busy===String(n.id)} onClick={()=>action(String(n.id),{action:"unread"})}>Označi kao nepročitano</button>:<button className="btn" disabled={busy===String(n.id)} onClick={()=>action(String(n.id),{action:"read"})}>Označi kao pročitano</button>}
              <button className="btn notification-delete" disabled={busy===String(n.id)} onClick={()=>{if(window.confirm("Obrisati ovu notifikaciju?"))void action(String(n.id),{action:"delete"})}}><Trash2 size={15}/> Obriši</button>
            </div>
          </div>}
        </article>
      })}
      {visible.length===0&&<div className="card notification-empty-center"><Bell size={36}/><h3>Nema notifikacija</h3><p>{filter==="unread"?"Sve poruke su pročitane.":filter==="reacted"?"Još niste reagovali ni na jednu poruku.":"Nove poruke će se pojaviti ovde."}</p></div>}
    </div>
  </div>;
}
