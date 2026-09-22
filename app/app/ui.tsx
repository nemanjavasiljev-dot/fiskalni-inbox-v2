"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Users } from "lucide-react";
import QrScanner from "@/components/QrScanner";
import UserBottomNav from "@/components/UserBottomNav";

const money=(v:any)=>new Intl.NumberFormat("sr-RS",{style:"currency",currency:"RSD"}).format(Number(v||0));
const dt=(v:any)=>v?new Intl.DateTimeFormat("sr-RS",{dateStyle:"short"}).format(new Date(v)):"—";

function monthDueDate(){
  const now=new Date();
  const due=new Date(now.getFullYear(),now.getMonth()+1,0);
  return new Intl.DateTimeFormat("sr-RS",{dateStyle:"long"}).format(due);
}
function monthLabel(){return new Intl.DateTimeFormat("sr-RS",{month:"long",year:"numeric"}).format(new Date());}

export default function Dashboard({profile,organizations,activeOrg,receipts,master}:any) {
  const router=useRouter();
  const [scan,setScan]=useState(false);
  const [query,setQuery]=useState("");
  const [searchOpen,setSearchOpen]=useState(false);
  const [moreOpen,setMoreOpen]=useState(false);
  const [navActive,setNavActive]=useState<"home"|"search"|"files"|"more">("home");
  const [showAccountants,setShowAccountants]=useState(false);
  const searchRef=useRef<HTMLInputElement>(null);

  const total=useMemo(()=>receipts.reduce((s:any,r:any)=>s+Number(r.total_amount||0),0),[receipts]);
  const tax=useMemo(()=>receipts.reduce((s:any,r:any)=>s+Number(r.total_tax||0),0),[receipts]);
  const needs=receipts.filter((r:any)=>r.verification_status!=="provereno").length;
  const filteredReceipts=useMemo(()=>{
    const q=query.trim().toLowerCase();
    if(!q) return receipts;
    return receipts.filter((r:any)=>[r.merchant_name,r.merchant_pib,r.invoice_number,r.category,r.note,r.payment_method].some(v=>String(v||"").toLowerCase().includes(q)));
  },[receipts,query]);

  if (profile.global_role==="master_admin" && master) {
    const orgMap=new Map(master.organizations.map((o:any)=>[o.id,o]));
    const profileMap=new Map(master.profiles.map((p:any)=>[p.user_id,p]));
    const companyUsersByOrg=new Map<string,number>();
    master.organizations.forEach((o:any)=>{
      const seats=master.members.filter((m:any)=>m.organization_id===o.id && (m.role==="owner"||m.role==="employee")).length;
      companyUsersByOrg.set(o.id,Math.max(1,seats));
    });
    const accountantIds: string[] = Array.from(
  new Set<string>(
    (master.members ?? [])
      .filter((m: any) => m.role === "accountant")
      .map((m: any) => String(m.user_id))
  )
);
    const accountants=accountantIds.map((id:string)=>{
      const assignments=master.members.filter((m:any)=>m.role==="accountant"&&String(m.user_id)===id);
      const orgIds: string[] = Array.from(
  new Set<string>(
    assignments.map((m: any) => String(m.organization_id))
  )
);
      const clients=orgIds.map((orgId:string)=>orgMap.get(orgId)).filter(Boolean);
      const users=orgIds.reduce((sum:number,orgId:string)=>sum+(companyUsersByOrg.get(orgId)||0),0);
      const p:any=profileMap.get(id)||{};
      return {id,name:p.full_name||p.username||p.auth_email||"Knjigovođa",email:p.auth_email||"",clients,users,payout:users*250};
    }).sort((a:any,b:any)=>b.payout-a.payout);
    const gross=master.organizations.reduce((sum:number,o:any)=>sum+(companyUsersByOrg.get(o.id)||1)*(o.plan==="premium"?2000:1250),0);
    const payouts=accountants.reduce((sum:number,a:any)=>sum+a.payout,0);
    const profit=gross-payouts;

    return <Shell profile={profile}>
      <div className="app-head"><div><span className="pill">MASTER ADMIN</span><h1>Biznis pregled</h1><p className="muted">Obračun za {monthLabel()}. Naknada knjigovođi: 250 RSD po korisniku aplikacije.</p></div></div>
      <div className="grid master-stats">
        <Stat label="Klijenti" value={master.organizations.length}/>
        <button className="card stat stat-button" onClick={()=>setShowAccountants(v=>!v)}><span>Knjigovođe</span><strong>{accountants.length}</strong><small>klik za listu</small></button>
        <Stat label="Bruto MRR" value={money(gross)}/>
        <Stat label="Naknade knjigovođama" value={money(payouts)}/>
        <Stat label="Profit*" value={money(profit)}/>
      </div>
      <div className="master-note">* Profit = pretplate − naknade knjigovođama, pre ostalih troškova poslovanja. Datum mesečnog obračuna/uplate: <b>{monthDueDate()}</b>.</div>

      {showAccountants&&<section className="master-section"><div className="section-title"><div><span className="pill">KNJIGOVOĐE</span><h2>Obračun knjigovođa</h2></div><button className="btn" onClick={()=>setShowAccountants(false)}>Sakrij</button></div><div className="grid accountant-grid">
        {accountants.map((a:any)=><div className="card accountant-card" key={a.id}><div className="accountant-head"><div className="accountant-avatar"><Users size={22}/></div><div><h3>{a.name}</h3><span>{a.email||"—"}</span></div></div><div className="accountant-kpis"><div><span>Klijenti</span><b>{a.clients.length}</b></div><div><span>Korisnici app</span><b>{a.users}</b></div><div><span>Za uplatu</span><b>{money(a.payout)}</b></div></div><div className="payout-line"><span>Uplatiti najkasnije</span><b>{monthDueDate()}</b></div><details><summary>Lista klijenata ({a.clients.length})</summary><div className="accountant-clients">{a.clients.map((o:any)=><div key={o.id}><span>{o.name}</span><b>{companyUsersByOrg.get(o.id)||1} koris.</b></div>)}</div></details></div>)}
        {accountants.length===0&&<div className="card empty-master">Nema dodeljenih knjigovođa.</div>}
      </div></section>}

      <section className="master-section"><div className="section-title"><div><span className="pill">KLIJENTI</span><h2>Pregled firmi</h2></div></div><div className="grid client-grid">
        {master.organizations.map((o:any)=>{const ms=master.members.filter((m:any)=>m.organization_id===o.id);const rc=master.receipts.filter((r:any)=>r.organization_id===o.id);const users=companyUsersByOrg.get(o.id)||1;return <div className="card client" key={o.id}><span className="badge">{String(o.plan||"basic").toUpperCase()}</span><h3>{o.name}</h3><div className="muted">PIB {o.pib||"—"}</div><div className="kpis"><span>RAČUNI<b>{rc.length}</b></span><span>KORISNICI<b>{users}</b></span><span>KNJIGOVOĐE<b>{ms.filter((m:any)=>m.role==="accountant").length}</b></span></div></div>})}
      </div></section>
    </Shell>;
  }

  const role=activeOrg?.role==="accountant"?"KNJIGOVOĐA":"FIRMA";
  const isCompanyUser=!!activeOrg && activeOrg.role!=="accountant";

  function goHome(){setNavActive("home");setSearchOpen(false);setMoreOpen(false);window.scrollTo({top:0,behavior:"smooth"});}
  function openSearch(){setNavActive("search");setSearchOpen(true);setMoreOpen(false);setTimeout(()=>searchRef.current?.focus(),80);}
  function openMore(){setNavActive("more");setMoreOpen(true);setSearchOpen(false);}
  function openScanner(){if(!activeOrg){router.push("/app/setup");return;}setMoreOpen(false);setSearchOpen(false);setScan(true);}
  function openFiles(){if(!activeOrg){router.push("/app/setup");return;}setNavActive("files");router.push(`/app/files?org=${activeOrg.organization_id}`);}

  return <Shell profile={profile} hasBottomNav={isCompanyUser}>
    <div className="app-head" id="home">
      <div><span className="pill">{role}</span><h1>{activeOrg?.name||"Fiskalni Inbox"}</h1><p className="muted">{activeOrg?.pib?`PIB ${activeOrg.pib}`:"Izaberite ili kreirajte firmu."}</p></div>
      <div className="actions">{organizations.length>1&&<select className="select" value={activeOrg?.organization_id||""} onChange={e=>router.push("/app?org="+e.target.value)}>{organizations.map((o:any)=><option value={o.organization_id} key={o.organization_id}>{o.name}</option>)}</select>}{activeOrg&&activeOrg.role==="accountant"&&<button className="btn" onClick={openFiles}><FileText size={17}/> Dokumenti klijenta</button>}{isCompanyUser&&<button className="btn btn-accent desktop-scan-btn" onClick={openScanner}>Skeniraj QR</button>}</div>
    </div>

    {!activeOrg?<Onboarding/>:<>
      {searchOpen&&<div className="card user-search-card"><div className="user-search-row"><span aria-hidden="true">⌕</span><input ref={searchRef} className="user-search-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Pretraži dobavljača, PIB, broj računa, kategoriju…"/>{query&&<button className="user-search-clear" onClick={()=>setQuery("")} aria-label="Obriši pretragu">×</button>}</div><div className="muted" style={{fontSize:12,marginTop:8}}>{query?`${filteredReceipts.length} rezultata`:"Pretražite kompletnu bazu računa."}</div></div>}
      <div className="grid stats"><Stat label="Broj računa" value={receipts.length}/><Stat label="Ukupni troškovi" value={money(total)}/><Stat label="PDV" value={money(tax)}/><Stat label="Za proveru" value={needs}/></div>
      <div className="card table-card" id="baza"><div className="table-tools"><div><b>Baza fiskalnih računa</b><div className="muted" style={{fontSize:12}}>{query?`${filteredReceipts.length} pronađeno`:`Poslednjih ${receipts.length} računa`}</div></div><div className="actions">{isCompanyUser&&<button className="btn" onClick={openFiles}>Fajlovi</button>}<a className="btn" href={`/api/export/csv?organization_id=${activeOrg.organization_id}`}>CSV</a></div></div><div className="table-wrap"><table><thead><tr><th>Datum</th><th>Dobavljač</th><th>PIB</th><th>Kategorija</th><th>PDV</th><th>Iznos</th><th>Status</th><th></th></tr></thead><tbody>{filteredReceipts.map((r:any)=><tr key={r.id}><td>{dt(r.sdc_time||r.created_at)}</td><td><b>{r.merchant_name||"—"}</b><div className="muted mono" style={{fontSize:10}}>{r.invoice_number||""}</div></td><td>{r.merchant_pib||"—"}</td><td>{r.category}</td><td>{money(r.total_tax)}</td><td><b>{money(r.total_amount)}</b></td><td><span className={`badge ${r.verification_status==="provereno"?"":"warn"}`}>{r.verification_status}</span></td><td><a className="btn" target="_blank" href={`/app/receipts/${r.id}/print`}>Štampa/PDF</a></td></tr>)}{filteredReceipts.length===0&&<tr><td colSpan={8}><div className="empty-state">Nema računa koji odgovaraju pretrazi.</div></td></tr>}</tbody></table></div></div>
    </>}

    {scan&&activeOrg&&<div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setScan(false)}}><div className="modal qr-modal"><div className="modal-head"><div><span className="pill">NOVI RAČUN</span><h2>QR skener</h2></div><button className="btn" onClick={()=>setScan(false)}>Zatvori</button></div><p className="muted" style={{marginTop:0}}>Usmerite kameru na QR kod fiskalnog računa.</p><QrScanner organizationId={activeOrg.organization_id} onDone={()=>{setScan(false);router.refresh()}}/></div></div>}
    {moreOpen&&isCompanyUser&&<div className="bottom-sheet-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setMoreOpen(false)}}><div className="bottom-sheet"><div className="bottom-sheet-handle"/><div className="bottom-sheet-head"><div><span className="pill">VIŠE</span><h3>Opcije naloga</h3></div><button className="btn" onClick={()=>setMoreOpen(false)}>Zatvori</button></div><div className="more-list"><div className="more-info"><span>Firma</span><b>{activeOrg.name}</b></div><div className="more-info"><span>Paket</span><b>{String(activeOrg.plan||"basic").toUpperCase()}</b></div><button className="more-action" onClick={openFiles}>Fajlovi <b>→</b></button><a className="more-action" href={`/api/export/csv?organization_id=${activeOrg.organization_id}`}>Izvezi bazu kao CSV <b>→</b></a><a className="more-action" href="/app/setup">Podešavanja firme <b>→</b></a><form method="post" action="/api/auth/logout"><button className="more-action danger" style={{width:"100%"}}>Odjavi se <b>→</b></button></form></div></div></div>}
    {isCompanyUser&&<UserBottomNav active={navActive} onHome={goHome} onSearch={openSearch} onScan={openScanner} onFiles={openFiles} onMore={openMore}/>} 
  </Shell>;
}

function Shell({profile,children,hasBottomNav=false}:any){return <div className={`app-shell ${hasBottomNav?"with-bottom-nav":""}`}><header className="appbar"><div className="container appbar-in"><a className="brand" href="/app"><span className="logo">F</span><span>Fiskalni Inbox</span></a><div className="actions"><span className="muted" style={{alignSelf:"center",fontSize:12}}>{profile.username}</span><form method="post" action="/api/auth/logout"><button className="btn">Odjava</button></form></div></div></header><main className="container app-main">{children}</main></div>}
function Stat({label,value}:any){return <div className="card stat"><span>{label}</span><strong>{value}</strong></div>}
function Onboarding(){return <div className="card" style={{padding:30,maxWidth:650}}><span className="pill">PRVI KORAK</span><h2>Povežite firmu</h2><p className="muted">Unesite PIB ili matični broj. Kada je APR API konfigurisan, podaci firme se popunjavaju automatski.</p><a className="btn btn-primary" href="/app/setup">Unesi PIB / matični broj</a></div>}
