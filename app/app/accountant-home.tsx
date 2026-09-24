"use client";
import React from "react";
import { Archive, Bell, CalendarDays, FileCheck2, FileText, Plus, ReceiptText, Search, Settings, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import BrandWordmark from "@/components/BrandWordmark";
import AccountantDesktopMenu from "@/components/AccountantDesktopMenu";
import PushNotificationOptIn from "@/components/PushNotificationOptIn";

const money=(v:any)=>new Intl.NumberFormat("sr-RS",{style:"currency",currency:"RSD"}).format(Number(v||0));
const dt=(v:any)=>v?new Intl.DateTimeFormat("sr-RS",{dateStyle:"short",timeStyle:"short"}).format(new Date(v)):"—";
function monthStart(d=new Date()){return new Date(d.getFullYear(),d.getMonth(),1)}
function inMonth(value:any,start:Date){if(!value)return false;const d=new Date(value);const end=new Date(start.getFullYear(),start.getMonth()+1,1);return d>=start&&d<end}
function currentMonthLabel(){return new Intl.DateTimeFormat("sr-RS",{month:"long",year:"numeric"}).format(new Date())}
function currentMonthKey(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`}
function previousMonthLabel(){const d=new Date();d.setMonth(d.getMonth()-1);return new Intl.DateTimeFormat("sr-RS",{month:"long",year:"numeric"}).format(d)}
function dueDate(day:number){const n=new Date();return new Intl.DateTimeFormat("sr-RS",{day:"2-digit",month:"long",year:"numeric"}).format(new Date(n.getFullYear(),n.getMonth(),day))}

export default function AccountantHome({profile,organizations,overview,context}:any){
  const router=useRouter();
  const [period,setPeriod]=React.useState<"month"|"total">("month");
  const [notificationsOpen,setNotificationsOpen]=React.useState(false);
  const [query,setQuery]=React.useState("");
  const [addOpen,setAddOpen]=React.useState(false);
  const [inviteChannel,setInviteChannel]=React.useState<"email"|"sms">("email");
  const [inviteContact,setInviteContact]=React.useState("");
  const [inviteBusy,setInviteBusy]=React.useState(false);
  const [inviteMessage,setInviteMessage]=React.useState("");
  const [intakeBusy,setIntakeBusy]=React.useState<"receipts"|"documents"|null>(null);
  const [intakeMessage,setIntakeMessage]=React.useState("");
  const start=monthStart();
  const settings=context?.userSettings||{notify_new_receipts:true,notify_new_documents:true,notify_deadlines:true};
  const receiptStatus: Map<string,any>=new Map((overview.receiptStatuses||[]).map((s:any)=>[String(s.receipt_id),s]));
  const documentStatus: Map<string,any>=new Map((overview.documentStatuses||[]).map((s:any)=>[String(s.document_id),s]));
  const periodReceipts=(overview.receipts||[]).filter((r:any)=>period==="total"||inMonth(r.sent_to_accountant_at||r.created_at,start));
  const periodDocuments=(overview.documents||[]).filter((d:any)=>period==="total"||inMonth(d.sent_at||d.created_at,start));
  const newReceipts=periodReceipts.filter((r:any)=>!receiptStatus.get(String(r.id))?.opened_at).length;
  const newDocuments=periodDocuments.filter((d:any)=>!documentStatus.get(String(d.id))?.opened_at).length;
  const assignedReceipts=(overview.receiptStatuses||[]).filter((s:any)=>s.opened_at&&(period==="total"||inMonth(s.opened_at,start))).length;
  const assignedDocuments=(overview.documentStatuses||[]).filter((s:any)=>s.opened_at&&(period==="total"||inMonth(s.opened_at,start))).length;
  const allUnreadDocs=(overview.documents||[]).filter((d:any)=>!documentStatus.get(String(d.id))?.opened_at);
  const allUnreadReceipts=(overview.receipts||[]).filter((r:any)=>!receiptStatus.get(String(r.id))?.opened_at);
  const connectionRequests=context?.incomingConnectionRequests||[];
  const notificationCount=(settings.notify_new_documents?allUnreadDocs.length:0)+(settings.notify_new_receipts?allUnreadReceipts.length:0)+connectionRequests.length;
  const orgMap=new Map(organizations.map((o:any)=>[String(o.organization_id),o]));

  const clientStats=organizations.map((o:any)=>{
    const id=String(o.organization_id);
    const receipts=(overview.receipts||[]).filter((r:any)=>String(r.organization_id)===id&&Boolean(receiptStatus.get(String(r.id))?.opened_at)&&(period==="total"||inMonth(r.sdc_time||r.created_at,start)));
    const docs=(overview.documents||[]).filter((d:any)=>String(d.organization_id)===id&&Boolean(documentStatus.get(String(d.id))?.opened_at)&&(period==="total"||inMonth(d.sent_at||d.created_at,start)));
    const vat=receipts.reduce((sum:number,r:any)=>sum+Number(r.total_tax||0),0);
    return {...o,receiptCount:receipts.length,documentCount:docs.length,vat};
  }).sort((a:any,b:any)=>(b.receiptCount+b.documentCount)-(a.receiptCount+a.documentCount)||String(a.name||"").localeCompare(String(b.name||""),"sr"));
  const q=query.trim().toLowerCase();
  const filteredClients=clientStats.filter((c:any)=>!q||String(c.name||"").toLowerCase().includes(q)||String(c.pib||"").includes(q));

  async function addClient(e:React.FormEvent){
    e.preventDefault();
    const contact=inviteContact.trim();
    if(!contact){setInviteMessage("Unesite email ili broj telefona klijenta.");return;}
    if(inviteChannel==="email"&&!/^\S+@\S+\.\S+$/.test(contact)){setInviteMessage("Unesite ispravan email klijenta.");return;}
    if(inviteChannel==="sms"&&contact.replace(/\D/g,"").length<8){setInviteMessage("Unesite ispravan broj telefona klijenta.");return;}
    setInviteBusy(true);setInviteMessage("");
    const r=await fetch("/api/connections/request",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({organization_id:context?.office?.organization_id||context?.office?.id,channel:inviteChannel,contact})});
    const d=await r.json();setInviteBusy(false);
    if(!r.ok){setInviteMessage(d.error||"Zahtev nije poslat.");return;}
    setInviteMessage(d.message||"Zahtev je poslat klijentu.");
    setInviteContact("");
    router.refresh();
  }

  async function assignAll(type:"receipts"|"documents") {
    setIntakeBusy(type);
    setIntakeMessage("");
    try {
      const r=await fetch("/api/accountant/intake/assign-all",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({type,month:period==="month"?currentMonthKey():null})
      });
      const d=await r.json();
      if(!r.ok){setIntakeMessage(d.error||"Prijem nije mogao da se obradi.");return;}
      const label=type==="receipts"?"računa":"dokumenata";
      const details=(d.breakdown||[]).map((x:any)=>`${x.name}: ${x.count}`).join(" · ");
      setIntakeMessage(d.assigned>0?`Raspoređeno ${d.assigned} ${label}${details?` — ${details}`:""}`:`Nema novih ${label} za raspoređivanje.`);
      router.refresh();
    } catch {
      setIntakeMessage("Prijem trenutno nije mogao da se obradi.");
    } finally {
      setIntakeBusy(null);
    }
  }

  async function reviewConnection(id:string,decision:"approve"|"reject"){
    const officeId=context?.office?.organization_id||context?.office?.id;
    const r=await fetch(`/api/connections/${id}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({decision,organization_id:officeId})});
    const d=await r.json();
    if(!r.ok){setInviteMessage(d.error||"Zahtev nije obrađen.");return;}
    setInviteMessage(d.message||"Zahtev je obrađen.");
    router.refresh();
  }

  const notificationItems=[
    ...(settings.notify_new_documents?allUnreadDocs.slice(0,6).map((d:any)=>({kind:"Dokument",id:d.id,org:d.organization_id,title:d.file_name,date:d.sent_at||d.created_at})):[]),
    ...(settings.notify_new_receipts?allUnreadReceipts.slice(0,6).map((r:any)=>({kind:"Račun",id:r.id,org:r.organization_id,title:r.merchant_name||r.invoice_number||"Fiskalni račun",date:r.sent_to_accountant_at||r.created_at})):[])
  ].sort((a:any,b:any)=>new Date(b.date).getTime()-new Date(a.date).getTime()).slice(0,10);

  return <div className="app-shell accountant-shell">
    <header className="appbar"><div className="container appbar-in"><a className="brand" href="/app"><span className="logo">F</span><BrandWordmark suffix=" · KNJIGO"/></a><div className="actions"><PushNotificationOptIn/><button className="btn notification-button" onClick={()=>setNotificationsOpen(v=>!v)}><Bell size={17}/>{notificationCount>0&&<span>{notificationCount}</span>}</button><a className="btn" href="/app/accountant/settings"><Settings size={16}/> Podešavanja</a><span className="muted accountant-username">{profile.username}</span><form method="post" action="/api/auth/logout"><button className="btn">Odjava</button></form></div></div></header>
    <div className="accountant-desktop-layout"><AccountantDesktopMenu isAdmin={Boolean(context?.isAdmin)}/><main className="app-main accountant-main">
      <div className="app-head accountant-head-main"><div><span className="pill">{context?.isAdmin?"ADMIN KNJIGOVOĐA":"KNJIGOVOĐA"}</span><h1>Radni pregled</h1><p className="muted">{context?.office?.name&&<><b>{context.office.name}</b> · </>}podrazumevano je prikazan tekući mesec: <b>{currentMonthLabel()}</b>.</p></div><div className="period-switch"><button className={period==="month"?"active":""} onClick={()=>setPeriod("month")}>Tekući mesec</button><button className={period==="total"?"active":""} onClick={()=>setPeriod("total")}>Ukupno</button></div></div>

      {notificationsOpen&&<div className="card notification-panel"><div className="notification-panel-head"><div><Bell size={18}/><b>Notifikacije</b></div><button onClick={()=>setNotificationsOpen(false)}>×</button></div>{connectionRequests.map((r:any)=><div key={`conn-${r.id}`} className="notification-row"><Users size={17}/><div><b>Novi zahtev za povezivanje</b><span>{r.sender_organization?.name||"Firma"}</span></div></div>)}{notificationItems.map((n:any)=>{const org:any=orgMap.get(String(n.org));return <a key={`${n.kind}-${n.id}`} className="notification-row" href={`/app/accountant/clients/${n.org}`}><FileText size={17}/><div><b>{n.kind}: {n.title}</b><span>{org?.name||"Klijent"} · {dt(n.date)}</span></div></a>})}{!connectionRequests.length&&!notificationItems.length&&<div className="notification-empty">Nema novih stavki prema vašim podešavanjima.</div>}</div>}

      {connectionRequests.length>0&&<div className="card company-requests-card connection-request-card"><div className="section-title"><div><span className="pill">NOVI ZAHTEVI</span><h3>Klijenti koji žele povezivanje</h3></div></div><div className="company-request-list">{connectionRequests.map((r:any)=><div key={r.id} className="company-request-row"><div><b>{r.sender_organization?.name||"Firma"}</b><span>Poslala je zahtev putem {r.channel==="sms"?"SMS-a":"emaila"}. Prihvatite da se firma doda u vaše klijente.</span></div><div className="actions"><button className="btn btn-primary" onClick={()=>reviewConnection(r.id,"approve")}>Prihvati</button><button className="btn" onClick={()=>reviewConnection(r.id,"reject")}>Odbij</button></div></div>)}</div></div>}

      <div className="grid accountant-summary-grid"><SummaryCard icon={<FileText/>} label="Novi dokumenti" value={newDocuments} note="čeka raspoređivanje"/><SummaryCard icon={<ReceiptText/>} label="Novi računi" value={newReceipts} note="čeka raspoređivanje"/><SummaryCard icon={<FileCheck2/>} label="Raspoređeni računi" value={assignedReceipts} note={period==="month"?"ovog meseca":"ukupno"}/><SummaryCard icon={<FileCheck2/>} label="Raspoređeni dokumenti" value={assignedDocuments} note={period==="month"?"ovog meseca":"ukupno"}/></div>

      <section className="accountant-section"><div className="section-title"><div><span className="pill">PRIJEM</span><h2>Računi i dokumenti klijenata</h2><p className="muted">Dugmad ispod ne preuzimaju fajlove. Ona primaju nove stavke i automatski ih raspoređuju odgovarajućim klijentima. Preuzimanje i štampa rade se tek unutar konkretnog klijenta.</p></div></div>{intakeMessage&&<div className="demo-box" style={{marginBottom:12}}>{intakeMessage}</div>}<div className="grid accountant-summary-grid"><div className="card accountant-summary-card"><div className="accountant-summary-icon"><ReceiptText/></div><div style={{flex:1}}><span>Fiskalni računi</span><strong>{periodReceipts.length}</strong><small>{newReceipts} novih</small><button className="btn btn-primary" style={{marginTop:10}} onClick={()=>assignAll("receipts")} disabled={intakeBusy!==null||newReceipts===0}><FileCheck2 size={15}/> {intakeBusy==="receipts"?"Raspoređujem…":"Preuzmi sve račune"}</button></div></div><div className="card accountant-summary-card"><div className="accountant-summary-icon"><FileText/></div><div style={{flex:1}}><span>Dokumenti</span><strong>{periodDocuments.length}</strong><small>{newDocuments} novih</small><button className="btn btn-primary" style={{marginTop:10}} onClick={()=>assignAll("documents")} disabled={intakeBusy!==null||newDocuments===0}><FileCheck2 size={15}/> {intakeBusy==="documents"?"Raspoređujem…":"Preuzmi sve dokumente"}</button></div></div></div></section>

      {settings.notify_deadlines&&<div className="grid deadline-grid"><div className="card deadline-card"><CalendarDays/><div><span>Obračun prethodnog meseca</span><b>do 10. u mesecu</b><small>{previousMonthLabel()} → {dueDate(10)}</small></div></div><div className="card deadline-card"><FileText/><div><span>Fakture</span><b>do 10. u mesecu</b><small>rok {dueDate(10)}</small></div></div><div className="card deadline-card"><ReceiptText/><div><span>PDV prijava</span><b>15. u mesecu</b><small>rok {dueDate(15)}</small></div></div></div>}

      <section className="accountant-section" id="clients"><div className="section-title accountant-client-title"><div><span className="pill"><Users size={13}/> KLIJENTI</span><h2>Klijenti i primljena dokumentacija</h2></div><div className="actions"><button className="btn btn-primary" onClick={()=>setAddOpen(true)}><Plus size={16}/> Pošalji zahtev</button></div></div><div className="accountant-client-tools"><div className="accountant-client-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Pretraži po nazivu ili PIB-u"/></div><span className="muted">{filteredClients.length} / {organizations.length} klijenata</span></div>
      <div className="grid accountant-client-grid">{filteredClients.map((c:any)=><a className="card accountant-client-card" href={`/app/accountant/clients/${c.organization_id}`} key={c.organization_id}><div className="client-card-identity"><ClientLogo organization={c}/><div className="accountant-client-top"><div><h3>{c.name}</h3><span>PIB {c.pib||"—"}</span></div></div></div><div className="accountant-client-kpis"><div><span>Računi</span><b>{c.receiptCount}</b><small>raspoređeno klijentu</small></div><div><span>Dokumenti</span><b>{c.documentCount}</b><small>raspoređeno klijentu</small></div><div><span>Ulazni PDV</span><b>{money(c.vat)}</b><small>fiskalni računi</small></div></div><div className="client-open">Otvori klijenta / preuzimanje / štampa →</div></a>)}{filteredClients.length===0&&<div className="card empty-client-search">Nema klijenta za zadatu pretragu.</div>}</div></section>

      <section className="accountant-section"><div className="section-title"><div><span className="pill"><Archive size={13}/> PDV PREGLED</span><h2>Ulazni PDV po klijentu</h2></div></div><div className="card vat-table"><div className="table-wrap"><table><thead><tr><th>Klijent</th><th>Računi</th><th>PDV sa fiskalnih računa</th><th></th></tr></thead><tbody>{filteredClients.map((c:any)=><tr key={c.organization_id}><td><b>{c.name}</b></td><td>{c.receiptCount}</td><td><b>{money(c.vat)}</b></td><td><a className="btn" href={`/app/accountant/clients/${c.organization_id}`}>Pregled / arhiva</a></td></tr>)}</tbody></table></div></div></section>
    </main></div>

    {addOpen&&<div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setAddOpen(false)}}><div className="modal add-client-modal"><div className="modal-head"><div><span className="pill">NOVI KLIJENT</span><h2>Pošalji zahtev klijentu</h2></div><button className="btn" onClick={()=>setAddOpen(false)}><X size={16}/> Zatvori</button></div><form onSubmit={addClient}><p className="muted">Unesite samo email ili telefon klijenta. Klijent dobija obaveštenje i prihvata zahtev u svom FiscalBox dashboardu.</p><div className="invite-channel-switch"><button type="button" className={inviteChannel==="email"?"active":""} onClick={()=>{setInviteChannel("email");setInviteContact("")}}>Email</button><button type="button" className={inviteChannel==="sms"?"active":""} onClick={()=>{setInviteChannel("sms");setInviteContact("")}}>SMS</button></div><div className="field" style={{marginTop:14}}><label>{inviteChannel==="email"?"Email klijenta":"Telefon klijenta"}</label><input className="input" type={inviteChannel==="email"?"email":"tel"} value={inviteContact} onChange={e=>setInviteContact(e.target.value)} placeholder={inviteChannel==="email"?"firma@domen.rs":"+381601234567"} required/></div>{inviteMessage&&<div className="demo-box">{inviteMessage}</div>}<button className="btn btn-primary" style={{width:"100%",marginTop:16}} disabled={inviteBusy||!inviteContact.trim()}>{inviteBusy?"Šaljem zahtev…":"Pošalji zahtev"}</button></form></div></div>}
  </div>;
}

function SummaryCard({icon,label,value,note}:any){return <div className="card accountant-summary-card"><div className="accountant-summary-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></div>}
function ClientLogo({organization}:any){const [bad,setBad]=React.useState(false);const initial=String(organization.name||"K").slice(0,1).toUpperCase();return <div className="client-logo">{organization.logo_path&&!bad?<img src={`/api/org/logo?organization_id=${organization.organization_id}`} alt="" onError={()=>setBad(true)}/>:<span>{initial}</span>}</div>}
