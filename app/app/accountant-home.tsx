"use client";
import React from "react";
import { Archive, Bell, CalendarDays, Download, FileCheck2, FileText, ReceiptText, Users } from "lucide-react";

const money=(v:any)=>new Intl.NumberFormat("sr-RS",{style:"currency",currency:"RSD"}).format(Number(v||0));
const dt=(v:any)=>v?new Intl.DateTimeFormat("sr-RS",{dateStyle:"short",timeStyle:"short"}).format(new Date(v)):"—";

function monthStart(d=new Date()){return new Date(d.getFullYear(),d.getMonth(),1)}
function inMonth(value:any,start:Date){if(!value)return false;const d=new Date(value);const end=new Date(start.getFullYear(),start.getMonth()+1,1);return d>=start&&d<end}
function currentMonthLabel(){return new Intl.DateTimeFormat("sr-RS",{month:"long",year:"numeric"}).format(new Date())}
function previousMonthLabel(){const d=new Date();d.setMonth(d.getMonth()-1);return new Intl.DateTimeFormat("sr-RS",{month:"long",year:"numeric"}).format(d)}
function dueDate(day:number){const n=new Date();return new Intl.DateTimeFormat("sr-RS",{day:"2-digit",month:"long",year:"numeric"}).format(new Date(n.getFullYear(),n.getMonth(),day))}

export default function AccountantHome({profile,organizations,overview}:any){
  const [period,setPeriod]=React.useState<"month"|"total">("month");
  const [notificationsOpen,setNotificationsOpen]=React.useState(false);
  const start=monthStart();
  const receiptStatus: Map<string,any>=new Map((overview.receiptStatuses||[]).map((s:any)=>[String(s.receipt_id),s]));
  const documentStatus: Map<string,any>=new Map((overview.documentStatuses||[]).map((s:any)=>[String(s.document_id),s]));
  const periodReceipts=(overview.receipts||[]).filter((r:any)=>period==="total"||inMonth(r.sent_to_accountant_at||r.created_at,start));
  const periodDocuments=(overview.documents||[]).filter((d:any)=>period==="total"||inMonth(d.sent_at||d.created_at,start));
  const newReceipts=periodReceipts.filter((r:any)=>!receiptStatus.get(String(r.id))?.opened_at).length;
  const newDocuments=periodDocuments.filter((d:any)=>!documentStatus.get(String(d.id))?.opened_at).length;
  const downloadedReceipts=(overview.receiptStatuses||[]).filter((s:any)=>s.downloaded_at&&(period==="total"||inMonth(s.downloaded_at,start))).length;
  const downloadedDocuments=(overview.documentStatuses||[]).filter((s:any)=>s.downloaded_at&&(period==="total"||inMonth(s.downloaded_at,start))).length;
  const allUnreadDocs=(overview.documents||[]).filter((d:any)=>!documentStatus.get(String(d.id))?.opened_at);
  const unreadDocs=allUnreadDocs.slice(0,8);
  const orgMap=new Map(organizations.map((o:any)=>[String(o.organization_id),o]));

  const clientStats=organizations.map((o:any)=>{
    const id=String(o.organization_id);
    const receipts=(overview.receipts||[]).filter((r:any)=>String(r.organization_id)===id&&(period==="total"||inMonth(r.sdc_time||r.created_at,start)));
    const docs=(overview.documents||[]).filter((d:any)=>String(d.organization_id)===id&&(period==="total"||inMonth(d.sent_at||d.created_at,start)));
    const newR=receipts.filter((r:any)=>!receiptStatus.get(String(r.id))?.opened_at).length;
    const newD=docs.filter((d:any)=>!documentStatus.get(String(d.id))?.opened_at).length;
    const vat=receipts.reduce((sum:number,r:any)=>sum+Number(r.total_tax||0),0);
    return {...o,receiptCount:receipts.length,documentCount:docs.length,newR,newD,vat};
  }).sort((a:any,b:any)=>(b.newR+b.newD)-(a.newR+a.newD));

  return <div className="app-shell accountant-shell">
    <header className="appbar"><div className="container appbar-in"><a className="brand" href="/app"><span className="logo">F</span><span>Fiskalni Inbox · KNJIGO</span></a><div className="actions"><button className="btn notification-button" onClick={()=>setNotificationsOpen(v=>!v)}><Bell size={17}/> {allUnreadDocs.length>0&&<span>{allUnreadDocs.length}</span>}</button><span className="muted" style={{alignSelf:"center",fontSize:12}}>{profile.username}</span><form method="post" action="/api/auth/logout"><button className="btn">Odjava</button></form></div></div></header>
    <main className="container app-main">
      <div className="app-head accountant-head-main"><div><span className="pill">KNJIGOVOĐA</span><h1>Radni pregled</h1><p className="muted">Podrazumevano je prikazan tekući mesec: <b>{currentMonthLabel()}</b>.</p></div><div className="period-switch"><button className={period==="month"?"active":""} onClick={()=>setPeriod("month")}>Tekući mesec</button><button className={period==="total"?"active":""} onClick={()=>setPeriod("total")}>Ukupno</button></div></div>

      {notificationsOpen&&<div className="card notification-panel"><div className="notification-panel-head"><div><Bell size={18}/><b>Novi dokumenti</b></div><button onClick={()=>setNotificationsOpen(false)}>×</button></div>{unreadDocs.length?unreadDocs.map((d:any)=>{const org:any=orgMap.get(String(d.organization_id));return <a key={d.id} className="notification-row" href={`/app/accountant/clients/${d.organization_id}`}><FileText size={17}/><div><b>{d.file_name}</b><span>{org?.name||"Klijent"} · {dt(d.sent_at||d.created_at)}</span></div></a>}):<div className="notification-empty">Nema novih neotvorenih dokumenata.</div>}</div>}

      <div className="grid accountant-summary-grid">
        <SummaryCard icon={<FileText/>} label="Novi dokumenti" value={newDocuments} note="neotvoreni"/>
        <SummaryCard icon={<ReceiptText/>} label="Novi računi" value={newReceipts} note="neotvoreni"/>
        <SummaryCard icon={<Download/>} label="Preuzeti računi" value={downloadedReceipts} note={period==="month"?"ovog meseca":"ukupno"}/>
        <SummaryCard icon={<FileCheck2/>} label="Preuzeti dokumenti" value={downloadedDocuments} note={period==="month"?"ovog meseca":"ukupno"}/>
      </div>

      <div className="grid deadline-grid">
        <div className="card deadline-card"><CalendarDays/><div><span>Obračun prethodnog meseca</span><b>do 10. u mesecu</b><small>{previousMonthLabel()} → {dueDate(10)}</small></div></div>
        <div className="card deadline-card"><FileText/><div><span>Fakture</span><b>do 10. u mesecu</b><small>rok {dueDate(10)}</small></div></div>
        <div className="card deadline-card"><ReceiptText/><div><span>PDV prijava</span><b>15. u mesecu</b><small>rok {dueDate(15)}</small></div></div>
      </div>

      <section className="accountant-section"><div className="section-title"><div><span className="pill"><Users size={13}/> KLIJENTI</span><h2>Klijenti i primljena dokumentacija</h2></div><span className="muted">{organizations.length} klijenata</span></div><div className="grid accountant-client-grid">{clientStats.map((c:any)=><a className="card accountant-client-card" href={`/app/accountant/clients/${c.organization_id}`} key={c.organization_id}><div className="accountant-client-top"><div><h3>{c.name}</h3><span>PIB {c.pib||"—"}</span></div>{(c.newR+c.newD)>0&&<span className="new-counter">{c.newR+c.newD} novo</span>}</div><div className="accountant-client-kpis"><div><span>Računi</span><b>{c.receiptCount}</b><small>{c.newR} novih</small></div><div><span>Dokumenti</span><b>{c.documentCount}</b><small>{c.newD} novih</small></div><div><span>Ulazni PDV</span><b>{money(c.vat)}</b><small>fiskalni računi</small></div></div><div className="client-open">Otvori klijenta →</div></a>)}</div></section>

      <section className="accountant-section"><div className="section-title"><div><span className="pill"><Archive size={13}/> PDV PREGLED</span><h2>Ulazni PDV po klijentu</h2></div></div><div className="card vat-table"><div className="table-wrap"><table><thead><tr><th>Klijent</th><th>Računi</th><th>PDV sa fiskalnih računa</th><th></th></tr></thead><tbody>{clientStats.map((c:any)=><tr key={c.organization_id}><td><b>{c.name}</b></td><td>{c.receiptCount}</td><td><b>{money(c.vat)}</b></td><td><a className="btn" href={`/app/accountant/clients/${c.organization_id}`}>Pregled / arhiva</a></td></tr>)}</tbody></table></div></div></section>
    </main>
  </div>;
}

function SummaryCard({icon,label,value,note}:any){return <div className="card accountant-summary-card"><div className="accountant-summary-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></div>}
