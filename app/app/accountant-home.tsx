"use client";
import React from "react";
import { Archive, Bell, CalendarDays, Download, FileCheck2, FileText, Plus, ReceiptText, Search, Settings, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";

const money=(v:any)=>new Intl.NumberFormat("sr-RS",{style:"currency",currency:"RSD"}).format(Number(v||0));
const dt=(v:any)=>v?new Intl.DateTimeFormat("sr-RS",{dateStyle:"short",timeStyle:"short"}).format(new Date(v)):"—";
function monthStart(d=new Date()){return new Date(d.getFullYear(),d.getMonth(),1)}
function inMonth(value:any,start:Date){if(!value)return false;const d=new Date(value);const end=new Date(start.getFullYear(),start.getMonth()+1,1);return d>=start&&d<end}
function currentMonthLabel(){return new Intl.DateTimeFormat("sr-RS",{month:"long",year:"numeric"}).format(new Date())}
function previousMonthLabel(){const d=new Date();d.setMonth(d.getMonth()-1);return new Intl.DateTimeFormat("sr-RS",{month:"long",year:"numeric"}).format(d)}
function dueDate(day:number){const n=new Date();return new Intl.DateTimeFormat("sr-RS",{day:"2-digit",month:"long",year:"numeric"}).format(new Date(n.getFullYear(),n.getMonth(),day))}

export default function AccountantHome({profile,organizations,overview,context}:any){
  const router=useRouter();
  const [period,setPeriod]=React.useState<"month"|"total">("month");
  const [notificationsOpen,setNotificationsOpen]=React.useState(false);
  const [query,setQuery]=React.useState("");
  const [addOpen,setAddOpen]=React.useState(false);
  const [pib,setPib]=React.useState("");
  const [companyName,setCompanyName]=React.useState("");
  const [email,setEmail]=React.useState("");
  const [phone,setPhone]=React.useState("");
  const [channel,setChannel]=React.useState<"email"|"sms"|"both">("email");
  const [lookupBusy,setLookupBusy]=React.useState(false);
  const [inviteBusy,setInviteBusy]=React.useState(false);
  const [inviteMessage,setInviteMessage]=React.useState("");
  const [inviteLink,setInviteLink]=React.useState("");
  const start=monthStart();
  const settings=context?.userSettings||{notify_new_receipts:true,notify_new_documents:true,notify_deadlines:true};
  const receiptStatus: Map<string,any>=new Map((overview.receiptStatuses||[]).map((s:any)=>[String(s.receipt_id),s]));
  const documentStatus: Map<string,any>=new Map((overview.documentStatuses||[]).map((s:any)=>[String(s.document_id),s]));
  const periodReceipts=(overview.receipts||[]).filter((r:any)=>period==="total"||inMonth(r.sent_to_accountant_at||r.created_at,start));
  const periodDocuments=(overview.documents||[]).filter((d:any)=>period==="total"||inMonth(d.sent_at||d.created_at,start));
  const newReceipts=periodReceipts.filter((r:any)=>!receiptStatus.get(String(r.id))?.opened_at).length;
  const newDocuments=periodDocuments.filter((d:any)=>!documentStatus.get(String(d.id))?.opened_at).length;
  const downloadedReceipts=(overview.receiptStatuses||[]).filter((s:any)=>s.downloaded_at&&(period==="total"||inMonth(s.downloaded_at,start))).length;
  const downloadedDocuments=(overview.documentStatuses||[]).filter((s:any)=>s.downloaded_at&&(period==="total"||inMonth(s.downloaded_at,start))).length;
  const allUnreadDocs=(overview.documents||[]).filter((d:any)=>!documentStatus.get(String(d.id))?.opened_at);
  const allUnreadReceipts=(overview.receipts||[]).filter((r:any)=>!receiptStatus.get(String(r.id))?.opened_at);
  const notificationCount=(settings.notify_new_documents?allUnreadDocs.length:0)+(settings.notify_new_receipts?allUnreadReceipts.length:0);
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
  const q=query.trim().toLowerCase();
  const filteredClients=clientStats.filter((c:any)=>!q||String(c.name||"").toLowerCase().includes(q)||String(c.pib||"").includes(q));

  async function lookupApr(){
    if(pib.length!==9){setInviteMessage("Unesite PIB od 9 cifara.");return;}
    setLookupBusy(true);setInviteMessage("");
    const r=await fetch("/api/apr/lookup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:pib})});
    const d=await r.json();setLookupBusy(false);
    if(r.ok){setCompanyName(d.company?.name||"");setInviteMessage("Podaci su učitani iz APR-a.");}
    else setInviteMessage(d.error||"APR trenutno nije dostupan. Naziv možete uneti ručno.");
  }
  async function addClient(e:React.FormEvent){
    e.preventDefault();setInviteBusy(true);setInviteMessage("");setInviteLink("");
    const r=await fetch("/api/accountant/clients/invite",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pib,company_name:companyName,email,phone,channel})});
    const d=await r.json();setInviteBusy(false);
    if(!r.ok){setInviteMessage(d.error||"Klijent nije dodat.");return;}
    if(d.linked_existing){setInviteMessage(`Klijent ${d.name} je već registrovan i sada je povezan sa vašom agencijom.`);setTimeout(()=>{setAddOpen(false);router.refresh()},1000);return;}
    setInviteLink(d.invite_url||"");
    const parts=[];if(d.email?.sent)parts.push("email poslat");else if((channel==="email"||channel==="both")&&!d.email?.configured)parts.push("email servis nije podešen");if(d.sms?.sent)parts.push("SMS poslat");else if((channel==="sms"||channel==="both")&&!d.sms?.configured)parts.push("SMS servis nije podešen");
    setInviteMessage(`Poziv je kreiran${parts.length?` · ${parts.join(" · ")}`:""}.`);
    router.refresh();
  }
  async function copyInvite(){if(inviteLink){await navigator.clipboard.writeText(inviteLink);setInviteMessage("Link poziva je kopiran.")}}

  const notificationItems=[
    ...(settings.notify_new_documents?allUnreadDocs.slice(0,6).map((d:any)=>({kind:"Dokument",id:d.id,org:d.organization_id,title:d.file_name,date:d.sent_at||d.created_at})):[]),
    ...(settings.notify_new_receipts?allUnreadReceipts.slice(0,6).map((r:any)=>({kind:"Račun",id:r.id,org:r.organization_id,title:r.merchant_name||r.invoice_number||"Fiskalni račun",date:r.sent_to_accountant_at||r.created_at})):[])
  ].sort((a:any,b:any)=>new Date(b.date).getTime()-new Date(a.date).getTime()).slice(0,10);

  return <div className="app-shell accountant-shell">
    <header className="appbar"><div className="container appbar-in"><a className="brand" href="/app"><span className="logo">F</span><span>FiscalBox · KNJIGO</span></a><div className="actions"><button className="btn notification-button" onClick={()=>setNotificationsOpen(v=>!v)}><Bell size={17}/>{notificationCount>0&&<span>{notificationCount}</span>}</button><a className="btn" href="/app/accountant/settings"><Settings size={16}/> Podešavanja</a><span className="muted accountant-username">{profile.username}</span><form method="post" action="/api/auth/logout"><button className="btn">Odjava</button></form></div></div></header>
    <main className="container app-main">
      <div className="app-head accountant-head-main"><div><span className="pill">{context?.isAdmin?"ADMIN KNJIGOVOĐA":"KNJIGOVOĐA"}</span><h1>Radni pregled</h1><p className="muted">{context?.office?.name&&<><b>{context.office.name}</b> · </>}podrazumevano je prikazan tekući mesec: <b>{currentMonthLabel()}</b>.</p></div><div className="period-switch"><button className={period==="month"?"active":""} onClick={()=>setPeriod("month")}>Tekući mesec</button><button className={period==="total"?"active":""} onClick={()=>setPeriod("total")}>Ukupno</button></div></div>

      {notificationsOpen&&<div className="card notification-panel"><div className="notification-panel-head"><div><Bell size={18}/><b>Notifikacije</b></div><button onClick={()=>setNotificationsOpen(false)}>×</button></div>{notificationItems.length?notificationItems.map((n:any)=>{const org:any=orgMap.get(String(n.org));return <a key={`${n.kind}-${n.id}`} className="notification-row" href={`/app/accountant/clients/${n.org}`}><FileText size={17}/><div><b>{n.kind}: {n.title}</b><span>{org?.name||"Klijent"} · {dt(n.date)}</span></div></a>}):<div className="notification-empty">Nema novih stavki prema vašim podešavanjima.</div>}</div>}

      <div className="grid accountant-summary-grid"><SummaryCard icon={<FileText/>} label="Novi dokumenti" value={newDocuments} note="neotvoreni"/><SummaryCard icon={<ReceiptText/>} label="Novi računi" value={newReceipts} note="neotvoreni"/><SummaryCard icon={<Download/>} label="Preuzeti računi" value={downloadedReceipts} note={period==="month"?"ovog meseca":"ukupno"}/><SummaryCard icon={<FileCheck2/>} label="Preuzeti dokumenti" value={downloadedDocuments} note={period==="month"?"ovog meseca":"ukupno"}/></div>

      {settings.notify_deadlines&&<div className="grid deadline-grid"><div className="card deadline-card"><CalendarDays/><div><span>Obračun prethodnog meseca</span><b>do 10. u mesecu</b><small>{previousMonthLabel()} → {dueDate(10)}</small></div></div><div className="card deadline-card"><FileText/><div><span>Fakture</span><b>do 10. u mesecu</b><small>rok {dueDate(10)}</small></div></div><div className="card deadline-card"><ReceiptText/><div><span>PDV prijava</span><b>15. u mesecu</b><small>rok {dueDate(15)}</small></div></div></div>}

      <section className="accountant-section"><div className="section-title accountant-client-title"><div><span className="pill"><Users size={13}/> KLIJENTI</span><h2>Klijenti i primljena dokumentacija</h2></div><div className="actions"><button className="btn btn-primary" onClick={()=>setAddOpen(true)}><Plus size={16}/> Dodaj klijenta</button></div></div><div className="accountant-client-tools"><div className="accountant-client-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Pretraži po nazivu ili PIB-u"/></div><span className="muted">{filteredClients.length} / {organizations.length} klijenata</span></div>
      {context?.pendingInvites?.length>0&&<div className="pending-invites"><b>Pozivi koji čekaju registraciju: {context.pendingInvites.length}</b><span>{context.pendingInvites.slice(0,3).map((x:any)=>`${x.company_name} (${x.company_pib})`).join(" · ")}</span></div>}
      <div className="grid accountant-client-grid">{filteredClients.map((c:any)=><a className="card accountant-client-card" href={`/app/accountant/clients/${c.organization_id}`} key={c.organization_id}><div className="client-card-identity"><ClientLogo organization={c}/><div className="accountant-client-top"><div><h3>{c.name}</h3><span>PIB {c.pib||"—"}</span></div>{(c.newR+c.newD)>0&&<span className="new-counter">{c.newR+c.newD} novo</span>}</div></div><div className="accountant-client-kpis"><div><span>Računi</span><b>{c.receiptCount}</b><small>{c.newR} novih</small></div><div><span>Dokumenti</span><b>{c.documentCount}</b><small>{c.newD} novih</small></div><div><span>Ulazni PDV</span><b>{money(c.vat)}</b><small>fiskalni računi</small></div></div><div className="client-open">Otvori klijenta / mesečnu arhivu →</div></a>)}{filteredClients.length===0&&<div className="card empty-client-search">Nema klijenta za zadatu pretragu.</div>}</div></section>

      <section className="accountant-section"><div className="section-title"><div><span className="pill"><Archive size={13}/> PDV PREGLED</span><h2>Ulazni PDV po klijentu</h2></div></div><div className="card vat-table"><div className="table-wrap"><table><thead><tr><th>Klijent</th><th>Računi</th><th>PDV sa fiskalnih računa</th><th></th></tr></thead><tbody>{filteredClients.map((c:any)=><tr key={c.organization_id}><td><b>{c.name}</b></td><td>{c.receiptCount}</td><td><b>{money(c.vat)}</b></td><td><a className="btn" href={`/app/accountant/clients/${c.organization_id}`}>Pregled / arhiva</a></td></tr>)}</tbody></table></div></div></section>
    </main>

    {addOpen&&<div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setAddOpen(false)}}><div className="modal add-client-modal"><div className="modal-head"><div><span className="pill">NOVI KLIJENT</span><h2>Dodaj klijenta</h2></div><button className="btn" onClick={()=>setAddOpen(false)}><X size={16}/> Zatvori</button></div><form onSubmit={addClient}><div className="field"><label>PIB klijenta</label><div className="lookup-row"><input className="input" inputMode="numeric" value={pib} onChange={e=>setPib(e.target.value.replace(/\D/g,"").slice(0,9))} placeholder="9 cifara" required/><button className="btn" type="button" onClick={lookupApr} disabled={lookupBusy}>{lookupBusy?"APR…":"Učitaj iz APR-a"}</button></div></div><div className="field"><label>Naziv firme</label><input className="input" value={companyName} onChange={e=>setCompanyName(e.target.value)} placeholder="Popunjava APR ili unesite ručno" required/></div><div className="field-grid"><div className="field"><label>Email klijenta</label><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="firma@domen.rs" required/></div><div className="field"><label>Telefon klijenta</label><input className="input" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+381..." required/></div></div><div className="field"><label>Pošalji poziv</label><select className="select" value={channel} onChange={e=>setChannel(e.target.value as any)}><option value="email">Email</option><option value="sms">SMS</option><option value="both">Email + SMS</option></select></div>{inviteMessage&&<div className="demo-box">{inviteMessage}{inviteLink&&<><br/><button type="button" className="btn" style={{marginTop:8}} onClick={copyInvite}>Kopiraj link poziva</button></>}</div>}<button className="btn btn-primary" style={{width:"100%",marginTop:16}} disabled={inviteBusy}>{inviteBusy?"Kreiram poziv…":"Dodaj klijenta i pošalji poziv"}</button></form></div></div>}
  </div>;
}

function SummaryCard({icon,label,value,note}:any){return <div className="card accountant-summary-card"><div className="accountant-summary-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></div>}
function ClientLogo({organization}:any){const [bad,setBad]=React.useState(false);const initial=String(organization.name||"K").slice(0,1).toUpperCase();return <div className="client-logo">{organization.logo_path&&!bad?<img src={`/api/org/logo?organization_id=${organization.organization_id}`} alt="" onError={()=>setBad(true)}/>:<span>{initial}</span>}</div>}
