"use client";
import React from "react";
import { ArrowLeft, Mail, MailOpen, PenLine, Reply, Send, Trash2, X } from "lucide-react";

const dt=(v:any)=>v?new Intl.DateTimeFormat("sr-RS",{dateStyle:"medium",timeStyle:"short"}).format(new Date(v)):"—";
const person=(p:any)=>p?.full_name||p?.username||p?.auth_email||"FiscalBox korisnik";

type Folder="inbox"|"sent"|"unread";
export default function MessageCenter({initialItems=[],currentUserId=""}:{initialItems?:any[];currentUserId?:string}){
  const [items,setItems]=React.useState<any[]>(initialItems);
  const [me,setMe]=React.useState(currentUserId);
  const [recipients,setRecipients]=React.useState<any[]>([]);
  const [folder,setFolder]=React.useState<Folder>("inbox");
  const [openId,setOpenId]=React.useState<string|null>(null);
  const [compose,setCompose]=React.useState(false);
  const [recipient,setRecipient]=React.useState("");
  const [subject,setSubject]=React.useState("");
  const [body,setBody]=React.useState("");
  const [parentId,setParentId]=React.useState<string|null>(null);
  const [busy,setBusy]=React.useState(false);
  const [message,setMessage]=React.useState("");

  const refresh=React.useCallback(async()=>{try{const r=await fetch("/api/messages",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Poruke nisu dostupne.");setItems(d.items||[]);setRecipients(d.recipients||[]);setMe(String(d.current_user_id||me));}catch(e:any){setMessage(e.message||"Poruke nisu dostupne.");}},[me]);
  React.useEffect(()=>{void refresh();const t=setInterval(()=>void refresh(),5000);return()=>clearInterval(t)},[refresh]);

  const visible=items.filter(m=>folder==="sent"?m.direction==="sent":folder==="unread"?m.direction==="received"&&!m.read_at:m.direction==="received");
  const unread=items.filter(m=>m.direction==="received"&&!m.read_at).length;
  const openMessage=items.find(m=>String(m.id)===openId)||null;

  async function patch(id:string,action:string){
    setBusy(true);setMessage("");
    try{const r=await fetch(`/api/messages/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Akcija nije uspela.");if(action==="delete"){setItems(old=>old.filter(x=>String(x.id)!==id));if(openId===id)setOpenId(null);}else setItems(old=>old.map(x=>String(x.id)===id?{...x,...d.item}:x));}
    catch(e:any){setMessage(e.message||"Akcija nije uspela.");}finally{setBusy(false);}
  }
  async function openItem(m:any){setOpenId(String(m.id));if(m.direction==="received"&&!m.read_at)await patch(String(m.id),"read");}
  function startReply(m:any){const other=m.direction==="received"?m.sender_user_id:m.recipient_user_id;setRecipient(String(other));setSubject(String(m.subject||"Poruka").startsWith("Re:")?m.subject:`Re: ${m.subject||"Poruka"}`);setBody("");setParentId(String(m.id));setCompose(true);}
  function newMessage(){setRecipient("");setSubject("");setBody("");setParentId(null);setCompose(true);}
  async function send(){
    if(!recipient||!body.trim()){setMessage("Izaberite primaoca i unesite poruku.");return;}
    setBusy(true);setMessage("");
    try{const r=await fetch("/api/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({recipient_user_id:recipient,subject:subject||"Poruka",body,parent_message_id:parentId})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Poruka nije poslata.");setCompose(false);setFolder("sent");setRecipient("");setSubject("");setBody("");setParentId(null);setMessage("Poruka je poslata.");await refresh();}
    catch(e:any){setMessage(e.message||"Poruka nije poslata.");}finally{setBusy(false);}
  }

  return <div className="message-center">
    <div className="message-toolbar">
      <div className="message-folders">
        <button className={folder==="inbox"?"active":""} onClick={()=>setFolder("inbox")}><Mail size={16}/> Primljene <span>{items.filter(m=>m.direction==="received").length}</span></button>
        <button className={folder==="sent"?"active":""} onClick={()=>setFolder("sent")}><Send size={16}/> Poslate <span>{items.filter(m=>m.direction==="sent").length}</span></button>
        <button className={folder==="unread"?"active":""} onClick={()=>setFolder("unread")}><MailOpen size={16}/> Nepročitane <span>{unread}</span></button>
      </div>
      <button className="btn btn-primary" onClick={newMessage}><PenLine size={16}/> Nova poruka</button>
    </div>
    {message&&<div className="home-message">{message}</div>}
    <div className="message-layout">
      <div className="message-list">
        {visible.map((m:any)=>{const other=m.direction==="received"?m.sender:m.recipient;return <button key={m.id} type="button" className={`message-list-item ${!m.read_at&&m.direction==="received"?"unread":""} ${openId===String(m.id)?"active":""}`} onClick={()=>openItem(m)}><span className="message-avatar">{String(person(other)).slice(0,1).toUpperCase()}</span><span className="message-list-copy"><b>{person(other)}</b><strong>{m.subject||"Poruka"}</strong><small>{String(m.body||"").slice(0,120)}</small><em>{dt(m.created_at)}</em></span>{!m.read_at&&m.direction==="received"&&<i/>}</button>})}
        {!visible.length&&<div className="message-empty"><Mail size={34}/><b>Nema poruka</b><span>{folder==="sent"?"Poslate poruke će se pojaviti ovde.":folder==="unread"?"Sve poruke su pročitane.":"Nove poruke će se pojaviti ovde."}</span></div>}
      </div>
      <div className="message-reader">
        {openMessage?<><div className="message-reader-head"><div><small>{openMessage.direction==="received"?"OD":"ZA"}</small><b>{person(openMessage.direction==="received"?openMessage.sender:openMessage.recipient)}</b><span>{dt(openMessage.created_at)}</span></div><div className="actions"><button className="btn" onClick={()=>startReply(openMessage)}><Reply size={15}/> Odgovori</button><button className="btn notification-delete" disabled={busy} onClick={()=>{if(confirm("Obrisati ovu poruku iz vašeg inboxa?"))void patch(String(openMessage.id),"delete")}}><Trash2 size={15}/> Obriši</button></div></div><h2>{openMessage.subject||"Poruka"}</h2><div className="message-reader-body">{openMessage.body}</div>{openMessage.direction==="received"&&<button className="btn" onClick={()=>patch(String(openMessage.id),openMessage.read_at?"unread":"read")}>{openMessage.read_at?"Označi kao nepročitano":"Označi kao pročitano"}</button>}</>:<div className="message-reader-placeholder"><MailOpen size={44}/><h3>Izaberite poruku</h3><p>Ovde možete da pročitate celu poruku, odgovorite ili je obrišete.</p></div>}
      </div>
    </div>
    {compose&&<div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setCompose(false)}}><div className="modal message-compose-modal"><div className="modal-head"><div><span className="pill">PORUKA</span><h2>{parentId?"Odgovori":"Nova poruka"}</h2></div><button className="btn" onClick={()=>setCompose(false)}><X size={16}/> Zatvori</button></div><div className="field"><label>Primalac</label><select className="select" value={recipient} onChange={e=>setRecipient(e.target.value)}><option value="">Izaberi primaoca…</option>{recipients.map((r:any)=><option key={r.user_id} value={r.user_id}>{r.label}{r.person&&r.person!==r.label?` · ${r.person}`:""}{r.email?` · ${r.email}`:""}</option>)}</select></div><div className="field"><label>Naslov</label><input className="input" value={subject} onChange={e=>setSubject(e.target.value)} maxLength={160}/></div><div className="field"><label>Poruka</label><textarea className="textarea" rows={8} value={body} onChange={e=>setBody(e.target.value)} maxLength={8000} autoFocus/></div><div className="actions"><button className="btn" onClick={()=>setCompose(false)}>Odustani</button><button className="btn btn-primary" onClick={send} disabled={busy||!recipient||!body.trim()}><Send size={16}/> {busy?"Šaljem…":"Pošalji"}</button></div></div></div>}
  </div>;
}
