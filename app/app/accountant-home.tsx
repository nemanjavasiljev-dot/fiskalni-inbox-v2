"use client";
import React from "react";
import { Archive, Bell, CalendarDays, Copy, FileCheck2, FileText, KeyRound, Plus, ReceiptText, Search, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import AccountantDesktopMenu from "@/components/AccountantDesktopMenu";
import CompanyLookup from "@/components/CompanyLookup";
import { receiptTotalTax } from "@/lib/fiscal";

const money=(v:any)=>new Intl.NumberFormat("sr-RS",{style:"currency",currency:"RSD"}).format(Number(v||0));
const dt=(v:any)=>v?new Intl.DateTimeFormat("sr-RS",{dateStyle:"short",timeStyle:"short"}).format(new Date(v)):"—";
function monthStart(d=new Date()){return new Date(d.getFullYear(),d.getMonth(),1)}
function inMonth(value:any,start:Date){if(!value)return false;const d=new Date(value);const end=new Date(start.getFullYear(),start.getMonth()+1,1);return d>=start&&d<end}
function currentMonthLabel(){return new Intl.DateTimeFormat("sr-RS",{month:"long",year:"numeric"}).format(new Date())}
function currentMonthKey(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`}
function previousMonthLabel(){const d=new Date();d.setMonth(d.getMonth()-1);return new Intl.DateTimeFormat("sr-RS",{month:"long",year:"numeric"}).format(d)}
function dueDate(day:number){const n=new Date();return new Intl.DateTimeFormat("sr-RS",{day:"2-digit",month:"long",year:"numeric"}).format(new Date(n.getFullYear(),n.getMonth(),day))}

function usernameFromCompany(company:any){
  const base=String(company?.name||"firma").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,22)||"firma";
  const suffix=String(company?.pib||company?.registration_number||"").replace(/\D/g,"").slice(-4);
  return `${base}${suffix?`_${suffix}`:""}`.slice(0,40);
}
function strongPassword(){
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes=new Uint32Array(16);
  crypto.getRandomValues(bytes);
  let value=Array.from(bytes,(n)=>chars[n%chars.length]).join("");
  if(!/[A-Z]/.test(value))value="A"+value.slice(1);
  if(!/[a-z]/.test(value))value=value.slice(0,1)+"a"+value.slice(2);
  if(!/[0-9]/.test(value))value=value.slice(0,2)+"7"+value.slice(3);
  return value;
}

export default function AccountantHome({profile,organizations,overview,context}:any){
  const router=useRouter();
  const [period,setPeriod]=React.useState<"month"|"total">("month");
  const [notificationsOpen,setNotificationsOpen]=React.useState(false);
  const [query,setQuery]=React.useState("");
  const [addOpen,setAddOpen]=React.useState(false);
  const [inviteMode,setInviteMode]=React.useState<"email"|"manual">("email");
  const [inviteCompany,setInviteCompany]=React.useState<any|null>(null);
  const [inviteEmail,setInviteEmail]=React.useState("");
  const [invitePlan,setInvitePlan]=React.useState<"basic"|"premium">("basic");
  const [manualUsername,setManualUsername]=React.useState("");
  const [manualPassword,setManualPassword]=React.useState("");
  const [createdCredentials,setCreatedCredentials]=React.useState<any|null>(null);
  const [inviteBusy,setInviteBusy]=React.useState(false);
  const [inviteMessage,setInviteMessage]=React.useState("");
  const [intakeBusy,setIntakeBusy]=React.useState<"receipts"|"documents"|null>(null);
  const [intakeMessage,setIntakeMessage]=React.useState("");
  const [databaseUpdated,setDatabaseUpdated]=React.useState(false);
  const [assignmentRequest,setAssignmentRequest]=React.useState<any|null>(null);
  const [assignmentEmployee,setAssignmentEmployee]=React.useState("");
  const [assignmentBusy,setAssignmentBusy]=React.useState(false);
  const start=monthStart();
  const settings=context?.userSettings||{notify_new_receipts:true,notify_new_documents:true,notify_deadlines:true};
  const receiptStatus: Map<string,any>=new Map((overview.receiptStatuses||[]).map((s:any)=>[String(s.receipt_id),s]));
  const documentStatus: Map<string,any>=new Map((overview.documentStatuses||[]).map((s:any)=>[String(s.document_id),s]));
  const periodReceipts=(overview.receipts||[]).filter((r:any)=>period==="total"||inMonth(r.sent_to_accountant_at||r.created_at,start));
  const periodDocuments=(overview.documents||[]).filter((d:any)=>period==="total"||inMonth(d.sent_at||d.created_at,start));
  const allUnreadDocs=(overview.documents||[]).filter((d:any)=>!documentStatus.get(String(d.id))?.opened_at);
  const allUnreadReceipts=(overview.receipts||[]).filter((r:any)=>!receiptStatus.get(String(r.id))?.opened_at);
  // "Novi" u prijemu uvek znači sve što je stiglo od poslednje sinhronizacije, bez obzira na izabrani period pregleda.
  const newReceipts=allUnreadReceipts.length;
  const newDocuments=allUnreadDocs.length;
  const assignedReceipts=(overview.receiptStatuses||[]).filter((s:any)=>s.opened_at&&(period==="total"||inMonth(s.opened_at,start))).length;
  const assignedDocuments=(overview.documentStatuses||[]).filter((s:any)=>s.opened_at&&(period==="total"||inMonth(s.opened_at,start))).length;
  const latestOpened=(rows:any[])=>rows.map((x:any)=>x?.opened_at).filter(Boolean).sort((a:any,b:any)=>new Date(b).getTime()-new Date(a).getTime())[0]||null;
  const lastReceiptSync=latestOpened(overview.receiptStatuses||[]);
  const lastDocumentSync=latestOpened(overview.documentStatuses||[]);
  const connectionRequests=context?.incomingConnectionRequests||[];
  const notificationCount=(settings.notify_new_documents?allUnreadDocs.length:0)+(settings.notify_new_receipts?allUnreadReceipts.length:0)+connectionRequests.length;
  const orgMap=new Map(organizations.map((o:any)=>[String(o.organization_id),o]));
  const assignableEmployees=(context?.staff||[]).filter((x:any)=>x.office_role==="employee");

  const clientStats=organizations.map((o:any)=>{
    const id=String(o.organization_id);
    const allClientReceipts=(overview.receipts||[]).filter((r:any)=>String(r.organization_id)===id&&Boolean(receiptStatus.get(String(r.id))?.opened_at));
    const allClientDocuments=(overview.documents||[]).filter((d:any)=>String(d.organization_id)===id&&Boolean(documentStatus.get(String(d.id))?.opened_at));
    const receipts=allClientReceipts.filter((r:any)=>period==="total"||inMonth(r.sdc_time||r.created_at,start));
    const docs=allClientDocuments.filter((d:any)=>period==="total"||inMonth(d.sent_at||d.created_at,start));
    const pendingReceipts=allClientReceipts.filter((r:any)=>{const st:any=receiptStatus.get(String(r.id));return !st?.downloaded_at&&!st?.printed_at}).length;
    const pendingDocuments=allClientDocuments.filter((d:any)=>!documentStatus.get(String(d.id))?.downloaded_at).length;
    const pendingWork=pendingReceipts+pendingDocuments;
    const vat=receipts.reduce((sum:number,r:any)=>sum+(r.vat_deductible===true?Number(receiptTotalTax(r)||0):0),0);
    return {...o,receiptCount:receipts.length,documentCount:docs.length,vat,pendingReceipts,pendingDocuments,pendingWork};
  }).sort((a:any,b:any)=>b.pendingWork-a.pendingWork||(b.receiptCount+b.documentCount)-(a.receiptCount+a.documentCount)||String(a.name||"").localeCompare(String(b.name||""),"sr"));
  const q=query.trim().toLowerCase();
  const filteredClients=clientStats.filter((c:any)=>!q||String(c.name||"").toLowerCase().includes(q)||String(c.pib||"").includes(q));

  function openAddClient(){
    setInviteMode("email");setInviteCompany(null);setInviteEmail("");setInvitePlan("basic");setManualUsername("");setManualPassword("");setCreatedCredentials(null);setInviteMessage("");setAddOpen(true);
  }

  function changeInviteMode(mode:"email"|"manual"){
    setInviteMode(mode);setInviteMessage("");setCreatedCredentials(null);
    if(mode==="manual"&&inviteCompany){
      setManualUsername(usernameFromCompany(inviteCompany));
      setManualPassword(strongPassword());
    }
  }

  function selectInviteCompany(company:any|null){
    setInviteCompany(company);setInviteMessage("");setCreatedCredentials(null);
    if(company&&inviteMode==="manual"){
      setManualUsername(usernameFromCompany(company));
      setManualPassword(strongPassword());
    }
  }

  async function addClient(e:React.FormEvent){
    e.preventDefault();
    const email=inviteEmail.trim().toLowerCase();
    if(!inviteCompany?.id){setInviteMessage("Izaberite klijenta iz APR/NBS pretrage.");return;}
    if(!/^\S+@\S+\.\S+$/.test(email)){setInviteMessage("Unesite ispravan email klijenta.");return;}
    if(inviteMode==="manual"&&(!manualUsername.trim()||manualPassword.length<10)){setInviteMessage("Generišite korisničko ime i lozinku za klijenta.");return;}
    setInviteBusy(true);setInviteMessage("");setCreatedCredentials(null);
    try{
      const endpoint=inviteMode==="manual"?"/api/accountant/clients/manual-create":"/api/accountant/clients/invite";
      const payload=inviteMode==="manual"
        ? {company_id:inviteCompany.id,email,username:manualUsername.trim().toLowerCase(),password:manualPassword,plan:invitePlan}
        : {company_id:inviteCompany.id,email,channel:"email",plan:invitePlan};
      const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||"Klijent nije dodat.");
      if(inviteMode==="manual"){
        setCreatedCredentials({company:d.company_name||inviteCompany.name,email,username:d.username||manualUsername,password:manualPassword,plan:invitePlan,proformaError:d.proforma_error||null});
        setInviteMessage(d.message||"Nalog klijenta je kreiran. Predajte kredencijale klijentu bezbednim kanalom.");
      }else{
        setInviteMessage(d.message||"Email poziv je poslat klijentu.");
        setInviteEmail("");setInviteCompany(null);setInvitePlan("basic");
      }
      router.refresh();
    }catch(e:any){setInviteMessage(e?.message||"Klijent nije dodat.");}
    finally{setInviteBusy(false);}
  }


  async function assignAll(type:"receipts"|"documents") {
    setIntakeBusy(type);
    setIntakeMessage("");
    try {
      const r=await fetch("/api/accountant/intake/assign-all",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        // Sinhronizacija uvek obrađuje SVE novo od prethodne sinhronizacije; period služi samo za pregled dashboarda.
        body:JSON.stringify({type,month:null})
      });
      const d=await r.json();
      if(!r.ok){setIntakeMessage(d.error||"Prijem nije mogao da se obradi.");return;}
      const label=type==="receipts"?"računa":"dokumenata";
      const details=(d.breakdown||[]).map((x:any)=>`${x.name}: ${x.count}`).join(" · ");
      if(d.assigned>0){
        setIntakeMessage(`Raspoređeno ${d.assigned} ${label}${details?` — ${details}`:""}.`);
        setDatabaseUpdated(true);
        window.setTimeout(()=>setDatabaseUpdated(false),5000);
      }else{
        setIntakeMessage(`Nema novih ${label} za raspoređivanje.`);
      }
      router.refresh();
    } catch {
      setIntakeMessage("Prijem trenutno nije mogao da se obradi.");
    } finally {
      setIntakeBusy(null);
    }
  }

  async function reviewConnection(id:string,decision:"approve"|"reject"){
    if(decision==="approve"&&context?.isAdmin){
      const row=liveConnectionRequests.find((x:any)=>String(x.id)===String(id))||connectionRequests.find((x:any)=>String(x.id)===String(id));
      setAssignmentRequest(row||{id});
      setAssignmentEmployee("");
      return;
    }
    const officeId=context?.office?.organization_id||context?.office?.id;
    const r=await fetch(`/api/connections/${id}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({decision,organization_id:officeId})});
    const d=await r.json();
    if(!r.ok){setInviteMessage(d.error||"Zahtev nije obrađen.");return;}
    setInviteMessage(d.message||"Zahtev je obrađen.");
    router.refresh();
  }

  async function approveAndAssign(){
    if(!assignmentRequest)return;
    const officeId=context?.office?.organization_id||context?.office?.id;
    setAssignmentBusy(true);setInviteMessage("");
    try{
      const r=await fetch(`/api/connections/${assignmentRequest.id}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({decision:"approve",organization_id:officeId,employee_user_id:assignmentEmployee||null})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||"Zahtev nije obrađen.");
      setInviteMessage(d.message||"Klijent je prihvaćen.");
      setAssignmentRequest(null);setAssignmentEmployee("");
      router.refresh();
    }catch(e:any){setInviteMessage(e?.message||"Zahtev nije obrađen.");}
    finally{setAssignmentBusy(false);}
  }

  const notificationItems=[
    ...(settings.notify_new_documents?allUnreadDocs.slice(0,6).map((d:any)=>({kind:"Dokument",id:d.id,org:d.organization_id,title:d.file_name,date:d.sent_at||d.created_at})):[]),
    ...(settings.notify_new_receipts?allUnreadReceipts.slice(0,6).map((r:any)=>({kind:"Račun",id:r.id,org:r.organization_id,title:r.merchant_name||r.invoice_number||"Fiskalni račun",date:r.sent_to_accountant_at||r.created_at})):[])
  ].sort((a:any,b:any)=>new Date(b.date).getTime()-new Date(a.date).getTime()).slice(0,10);

  const [liveNotificationCount,setLiveNotificationCount]=React.useState(notificationCount);
  const [liveConnectionRequests,setLiveConnectionRequests]=React.useState<any[]>(connectionRequests);
  const [liveNotificationItems,setLiveNotificationItems]=React.useState<any[]>(notificationItems);
  const notificationSignature=React.useRef<string|null>(null);

  React.useEffect(()=>{
    let cancelled=false;
    async function pollNotifications(){
      try{
        const response=await fetch("/api/accountant/notifications",{cache:"no-store",headers:{"Cache-Control":"no-cache"}});
        if(!response.ok)return;
        const data=await response.json();
        if(cancelled)return;
        setLiveNotificationCount(Number(data.count||0));
        setLiveConnectionRequests(Array.isArray(data.connection_requests)?data.connection_requests:[]);
        setLiveNotificationItems(Array.isArray(data.items)?data.items:[]);
        const nextSignature=String(data.signature||"");
        if(notificationSignature.current===null){notificationSignature.current=nextSignature;return;}
        if(nextSignature!==notificationSignature.current){
          notificationSignature.current=nextSignature;
          router.refresh();
        }
      }catch{}
    }
    void pollNotifications();
    const timer=window.setInterval(()=>{void pollNotifications()},5000);
    return()=>{cancelled=true;window.clearInterval(timer)};
  },[router]);

  return <div className="app-shell accountant-shell">
    <div className="accountant-desktop-layout"><AccountantDesktopMenu isAdmin={Boolean(context?.isAdmin)} username={profile.username||profile.full_name||profile.auth_email||""} notificationCount={liveNotificationCount} onNotificationsClick={()=>setNotificationsOpen(v=>!v)}/><main className="app-main accountant-main">
      <div className="app-head accountant-head-main"><div><span className="pill">{context?.isAdmin?"ADMIN KNJIGOVOĐA":"KNJIGOVOĐA"}</span><h1>Radni pregled</h1><p className="muted">{context?.office?.name&&<><b>{context.office.name}</b> · </>}podrazumevano je prikazan tekući mesec: <b>{currentMonthLabel()}</b>.</p></div><div className="period-switch"><button className={period==="month"?"active":""} onClick={()=>setPeriod("month")}>Tekući mesec</button><button className={period==="total"?"active":""} onClick={()=>setPeriod("total")}>Ukupno</button></div></div>

      {notificationsOpen&&<div className="card notification-panel"><div className="notification-panel-head"><div><Bell size={18}/><b>Notifikacije</b></div><button onClick={()=>setNotificationsOpen(false)}>×</button></div>{liveConnectionRequests.map((r:any)=><div key={`conn-${r.id}`} className="notification-row"><Users size={17}/><div><b>Novi zahtev za povezivanje</b><span>{r.sender_organization?.name||"Firma"}</span></div></div>)}{liveNotificationItems.map((n:any)=>{const org:any=orgMap.get(String(n.org));return <a key={`${n.kind}-${n.id}`} className="notification-row" href={`/app/accountant/clients/${n.org}`}><FileText size={17}/><div><b>{n.kind}: {n.title}</b><span>{org?.name||"Klijent"} · {dt(n.date)}</span></div></a>})}{!liveConnectionRequests.length&&!liveNotificationItems.length&&<div className="notification-empty">Nema novih stavki prema vašim podešavanjima.</div>}</div>}

      {liveConnectionRequests.length>0&&<div className="card company-requests-card connection-request-card"><div className="section-title"><div><span className="pill">NOVI ZAHTEVI</span><h3>Klijenti koji žele povezivanje</h3></div></div><div className="company-request-list">{liveConnectionRequests.map((r:any)=><div key={r.id} className="company-request-row"><div><b>{r.sender_organization?.name||"Firma"}</b><span>Poslala je zahtev putem {r.channel==="sms"?"SMS-a":"emaila"}. Prihvatite da se firma doda u vaše klijente.</span></div><div className="actions"><button className="btn btn-primary" onClick={()=>reviewConnection(r.id,"approve")}>Prihvati</button><button className="btn" onClick={()=>reviewConnection(r.id,"reject")}>Odbij</button></div></div>)}</div></div>}

      <div className="grid accountant-summary-grid"><SummaryCard icon={<FileText/>} label="Novi dokumenti" value={newDocuments} note="od poslednje sinhronizacije"/><SummaryCard icon={<ReceiptText/>} label="Novi računi" value={newReceipts} note="od poslednje sinhronizacije"/><SummaryCard icon={<FileCheck2/>} label="Raspoređeni računi" value={assignedReceipts} note={period==="month"?"ovog meseca":"ukupno"}/><SummaryCard icon={<FileCheck2/>} label="Raspoređeni dokumenti" value={assignedDocuments} note={period==="month"?"ovog meseca":"ukupno"}/></div>

      <section className="accountant-sync-section" aria-label="Sinhronizacija prijema">
        {intakeMessage&&<div className="demo-box accountant-sync-message">{intakeMessage}</div>}
        <div className="accountant-sync-grid">
          <div className="card accountant-sync-card">
            <div className="accountant-sync-card-head"><div className="accountant-sync-big-icon"><ReceiptText/></div><div><span>PRIJEM RAČUNA</span><h3>Preuzmi fiskalne</h3><p>{newReceipts} novih fiskalnih računa od poslednje sinhronizacije.</p></div></div>
            <div className="accountant-sync-meta"><span>Poslednja sinhronizacija</span><b>{lastReceiptSync?dt(lastReceiptSync):"Nije još izvršena"}</b></div>
            <button className="btn btn-primary accountant-sync-button" onClick={()=>assignAll("receipts")} disabled={intakeBusy!==null||newReceipts===0}><FileCheck2 size={18}/> {intakeBusy==="receipts"?"Sinhronizujem…":"Preuzmi fiskalne"}</button>
          </div>
          <div className="card accountant-sync-card">
            <div className="accountant-sync-card-head"><div className="accountant-sync-big-icon"><FileText/></div><div><span>PRIJEM DOKUMENATA</span><h3>Preuzmi dokumenta</h3><p>{newDocuments} novih dokumenata od poslednje sinhronizacije.</p></div></div>
            <div className="accountant-sync-meta"><span>Poslednja sinhronizacija</span><b>{lastDocumentSync?dt(lastDocumentSync):"Nije još izvršena"}</b></div>
            <button className="btn btn-primary accountant-sync-button" onClick={()=>assignAll("documents")} disabled={intakeBusy!==null||newDocuments===0}><FileCheck2 size={18}/> {intakeBusy==="documents"?"Sinhronizujem…":"Preuzmi dokumenta"}</button>
          </div>
        </div>
      </section>

      {settings.notify_deadlines&&<div className="grid deadline-grid"><div className="card deadline-card"><CalendarDays/><div><span>Obračun prethodnog meseca</span><b>do 10. u mesecu</b><small>{previousMonthLabel()} → {dueDate(10)}</small></div></div><div className="card deadline-card"><FileText/><div><span>Fakture</span><b>do 10. u mesecu</b><small>rok {dueDate(10)}</small></div></div><div className="card deadline-card"><ReceiptText/><div><span>PDV prijava</span><b>15. u mesecu</b><small>rok {dueDate(15)}</small></div></div></div>}

      <section className="accountant-section" id="clients"><div className="section-title accountant-client-title"><div><span className="pill"><Users size={13}/> KLIJENTI</span><h2>Klijenti i primljena dokumentacija</h2></div><div className="actions"><button className="btn btn-primary" onClick={openAddClient}><Plus size={16}/> Dodaj novog klijenta</button></div></div><div className="accountant-client-tools"><div className="accountant-client-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Pretraži po nazivu ili PIB-u"/></div><span className="muted">{filteredClients.length} / {organizations.length} klijenata</span></div>
      <div className="grid accountant-client-grid">{filteredClients.map((c:any)=><a className="card accountant-client-card" href={`/app/accountant/clients/${c.organization_id}`} key={c.organization_id}><div className={`client-pending-badge ${c.pendingWork===0?"is-clear":""}`} title={`Neodrađeno: ${c.pendingReceipts} računa i ${c.pendingDocuments} dokumenata`} aria-label={`${c.pendingWork} neodrađenih stavki`}><Bell size={13}/><b>{c.pendingWork}</b></div><div className="client-card-identity"><ClientLogo organization={c}/><div className="accountant-client-top"><div><h3>{c.name}</h3><span>PIB {c.pib||"—"}</span></div></div></div><div className="accountant-client-kpis"><div><span>Računi</span><b>{c.receiptCount}</b><small>raspoređeno klijentu</small></div><div><span>Dokumenti</span><b>{c.documentCount}</b><small>raspoređeno klijentu</small></div><div><span>Ulazni PDV</span><b>{money(c.vat)}</b><small>konačno prihvaćen PDV</small></div></div><div className="client-open">Otvori klijenta / preuzimanje / štampa →</div></a>)}{filteredClients.length===0&&<div className="card empty-client-search">Nema klijenta za zadatu pretragu.</div>}</div></section>

      <section className="accountant-section"><div className="section-title"><div><span className="pill"><Archive size={13}/> PDV PREGLED</span><h2>Ulazni PDV po klijentu</h2></div></div><div className="card vat-table"><div className="table-wrap"><table><thead><tr><th>Klijent</th><th>Računi</th><th>Prihvaćen ulazni PDV</th><th></th></tr></thead><tbody>{filteredClients.map((c:any)=><tr key={c.organization_id}><td><b>{c.name}</b></td><td>{c.receiptCount}</td><td><b>{money(c.vat)}</b></td><td><a className="btn" href={`/app/accountant/clients/${c.organization_id}`}>Pregled / arhiva</a></td></tr>)}</tbody></table></div></div></section>
    </main></div>

    {databaseUpdated&&<div className="database-updated-toast" role="status"><FileCheck2 size={20}/><div><b>Baza je ažurirana</b><span>Nove stavke su raspoređene klijentima.</span></div></div>}

    {assignmentRequest&&<div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target&&!assignmentBusy)setAssignmentRequest(null)}}><div className="modal assign-client-modal"><div className="modal-head"><div><span className="pill">NOVI KLIJENT</span><h2>Dodeli klijenta zaposlenom</h2></div><button className="btn" disabled={assignmentBusy} onClick={()=>setAssignmentRequest(null)}><X size={16}/> Zatvori</button></div><p className="muted"><b>{assignmentRequest.sender_organization?.name||"Novi klijent"}</b> je prihvaćen tek kada kliknete dugme ispod. Izaberite zaposlenog kome klijent pripada ili ga ostavite kod ADMIN knjigovođe.</p><div className="field"><label>Dodela klijenta</label><select className="select" value={assignmentEmployee} onChange={e=>setAssignmentEmployee(e.target.value)}><option value="">ADMIN knjigovođa / ostavi kod mene</option>{assignableEmployees.map((employee:any)=><option key={employee.user_id} value={employee.user_id}>{employee.full_name||employee.username||employee.auth_email||"Zaposleni"}</option>)}</select></div>{assignableEmployees.length===0&&<div className="demo-box">Nemate dodatih zaposlenih. Klijent će biti dodeljen ADMIN knjigovođi.</div>}<button className="btn btn-primary" style={{width:"100%",marginTop:16}} onClick={approveAndAssign} disabled={assignmentBusy}>{assignmentBusy?"Dodeljujem…":"Dodeli i prihvati klijenta"}</button></div></div>}

    {addOpen&&<div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target&&!inviteBusy)setAddOpen(false)}}><div className="modal add-client-modal"><div className="modal-head"><div><span className="pill">NOVI KLIJENT</span><h2>Dodaj novog klijenta</h2></div><button className="btn" disabled={inviteBusy} onClick={()=>setAddOpen(false)}><X size={16}/> Zatvori</button></div><form onSubmit={addClient}><p className="muted">Izaberite firmu i paket. Email šalje poziv klijentu, dok Ručno omogućava da knjigovođa odmah otvori nalog i sam dodeli kredencijale — bez email potvrde.</p><div className="invite-channel-switch"><button type="button" className={inviteMode==="email"?"active":""} onClick={()=>changeInviteMode("email")}>Email</button><button type="button" className={inviteMode==="manual"?"active":""} onClick={()=>changeInviteMode("manual")}>Ručno</button></div><div style={{marginTop:14}}><CompanyLookup value={inviteCompany} onSelect={selectInviteCompany} label="PIB klijenta" required showDetails={true}/></div><div className="field" style={{marginTop:14}}><label>Email klijenta</label><input className="input" type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="firma@domen.rs" required/><small className="muted">{inviteMode==="manual"?"Email se upisuje u nalog, ali potvrda emaila nije potrebna.":"Na ovaj email stiže aktivacioni poziv."}</small></div><div className="field"><label>Pretplata klijenta</label><select className="select" value={invitePlan} onChange={e=>setInvitePlan(e.target.value==="premium"?"premium":"basic")}><option value="basic">BASIC — 1.250 RSD mesečno</option><option value="premium">PREMIUM — 1.790 RSD mesečno</option></select><small className="muted">Knjigovođa ne plaća pretplatu. Paket se odnosi isključivo na klijenta.</small></div>{inviteMode==="manual"&&<div className="manual-client-credentials"><div className="manual-client-credentials-head"><KeyRound size={18}/><div><b>Kredencijali klijenta</b><span>Knjigovođa ih generiše i predaje klijentu.</span></div><button type="button" className="btn" onClick={()=>{setManualUsername(usernameFromCompany(inviteCompany));setManualPassword(strongPassword());}}>Generiši ponovo</button></div><div className="field"><label>Korisničko ime</label><input className="input mono" value={manualUsername} onChange={e=>setManualUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g,""))} placeholder="firma_1234" required/></div><div className="field"><label>Lozinka</label><div className="manual-credential-row"><input className="input mono" value={manualPassword} onChange={e=>setManualPassword(e.target.value)} required/><button type="button" className="btn" onClick={()=>setManualPassword(strongPassword())}>Nova lozinka</button></div></div><small className="muted">Lozinka se ne čuva u čitljivom obliku. Sačuvajte je sada i predajte klijentu bezbednim kanalom.</small></div>}{createdCredentials&&<div className="created-client-credentials"><b>✓ Nalog klijenta je aktivan</b><span>{createdCredentials.company}</span><div><small>Email</small><code>{createdCredentials.email}</code></div><div><small>Korisničko ime</small><code>{createdCredentials.username}</code><button type="button" onClick={()=>navigator.clipboard?.writeText(createdCredentials.username)}><Copy size={14}/></button></div><div><small>Lozinka</small><code>{createdCredentials.password}</code><button type="button" onClick={()=>navigator.clipboard?.writeText(createdCredentials.password)}><Copy size={14}/></button></div><div><small>Paket</small><code>{String(createdCredentials.plan).toUpperCase()}</code></div>{createdCredentials.proformaError&&<small className="error">Predračun: {createdCredentials.proformaError}</small>}</div>}{inviteMessage&&<div className="demo-box">{inviteMessage}</div>}<button className="btn btn-primary" style={{width:"100%",marginTop:16}} disabled={inviteBusy||!inviteCompany||!inviteEmail.trim()||Boolean(createdCredentials)}>{inviteBusy?(inviteMode==="manual"?"Kreiram nalog…":"Šaljem poziv…"):(inviteMode==="manual"?"Kreiraj nalog klijenta":"Pošalji email poziv")}</button></form></div></div>}
  </div>;
}

function SummaryCard({icon,label,value,note}:any){return <div className="card accountant-summary-card"><div className="accountant-summary-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></div>}
function ClientLogo({organization}:any){const [bad,setBad]=React.useState(false);const initial=String(organization.name||"K").slice(0,1).toUpperCase();return <div className="client-logo">{organization.logo_path&&!bad?<img src={`/api/org/logo?organization_id=${organization.organization_id}`} alt="" onError={()=>setBad(true)}/>:<span>{initial}</span>}</div>}
