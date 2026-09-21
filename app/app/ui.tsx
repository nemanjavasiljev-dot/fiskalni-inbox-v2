"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import QrScanner from "@/components/QrScanner";

const money=(v:any)=>new Intl.NumberFormat("sr-RS",{style:"currency",currency:"RSD"}).format(Number(v||0));
const dt=(v:any)=>v?new Intl.DateTimeFormat("sr-RS",{dateStyle:"short"}).format(new Date(v)):"—";

export default function Dashboard({profile,organizations,activeOrg,receipts,master}:any) {
  const router=useRouter();
  const [scan,setScan]=useState(false);
  const total=useMemo(()=>receipts.reduce((s:any,r:any)=>s+Number(r.total_amount||0),0),[receipts]);
  const tax=useMemo(()=>receipts.reduce((s:any,r:any)=>s+Number(r.total_tax||0),0),[receipts]);
  const needs=receipts.filter((r:any)=>r.verification_status!=="provereno").length;

  if (profile.global_role==="master_admin" && master) {
    const accountantIds=new Set(master.members.filter((m:any)=>m.role==="accountant").map((m:any)=>m.user_id));
    return <Shell profile={profile}>
      <div className="app-head"><div><span className="pill">MASTER ADMIN</span><h1>Biznis pregled</h1><p className="muted">Klijenti, knjigovođe, računi i pretplate.</p></div></div>
      <div className="grid stats">
        <Stat label="Klijenti" value={master.organizations.length}/>
        <Stat label="Knjigovođe" value={accountantIds.size}/>
        <Stat label="Računi" value={master.receipts.length}/>
        <Stat label="MRR procena" value={money(master.organizations.reduce((s:any,o:any)=>s+(o.plan==="premium"?2000:1250),0))}/>
      </div>
      <div className="grid client-grid" style={{marginTop:20}}>
        {master.organizations.map((o:any)=>{
          const ms=master.members.filter((m:any)=>m.organization_id===o.id);
          const rc=master.receipts.filter((r:any)=>r.organization_id===o.id);
          return <div className="card client" key={o.id}>
            <span className="badge">{String(o.plan||"basic").toUpperCase()}</span>
            <h3>{o.name}</h3><div className="muted">PIB {o.pib||"—"}</div>
            <div className="kpis"><span>RAČUNI<b>{rc.length}</b></span><span>KORISNICI<b>{ms.length}</b></span><span>KNJIGOVOĐE<b>{ms.filter((m:any)=>m.role==="accountant").length}</b></span></div>
          </div>
        })}
      </div>
    </Shell>
  }

  const role=activeOrg?.role==="accountant"?"KNJIGOVOĐA":"FIRMA";
  return <Shell profile={profile}>
    <div className="app-head">
      <div><span className="pill">{role}</span><h1>{activeOrg?.name||"Fiskalni Inbox"}</h1><p className="muted">{activeOrg?.pib?"PIB "+activeOrg.pib:"Izaberite ili kreirajte firmu."}</p></div>
      <div className="actions">
        {organizations.length>1 && <select className="select" value={activeOrg?.organization_id||""} onChange={e=>router.push("/app?org="+e.target.value)}>{organizations.map((o:any)=><option value={o.organization_id} key={o.organization_id}>{o.name}</option>)}</select>}
        {activeOrg && activeOrg.role!=="accountant" && <button className="btn btn-accent" onClick={()=>setScan(true)}>Skeniraj QR</button>}
      </div>
    </div>

    {!activeOrg ? <Onboarding /> : <>
      <div className="grid stats">
        <Stat label="Broj računa" value={receipts.length}/>
        <Stat label="Ukupni troškovi" value={money(total)}/>
        <Stat label="PDV" value={money(tax)}/>
        <Stat label="Za proveru" value={needs}/>
      </div>
      <div className="card table-card">
        <div className="table-tools"><div><b>Fiskalni računi</b><div className="muted" style={{fontSize:12}}>Poslednjih {receipts.length} računa</div></div><div className="actions"><a className="btn" href={"/api/export/csv?organization_id="+activeOrg.organization_id}>CSV</a></div></div>
        <div className="table-wrap"><table><thead><tr><th>Datum</th><th>Dobavljač</th><th>PIB</th><th>Kategorija</th><th>PDV</th><th>Iznos</th><th>Status</th><th></th></tr></thead><tbody>
          {receipts.map((r:any)=><tr key={r.id}><td>{dt(r.sdc_time||r.created_at)}</td><td><b>{r.merchant_name||"—"}</b><div className="muted mono" style={{fontSize:10}}>{r.invoice_number||""}</div></td><td>{r.merchant_pib||"—"}</td><td>{r.category}</td><td>{money(r.total_tax)}</td><td><b>{money(r.total_amount)}</b></td><td><span className={"badge "+(r.verification_status==="provereno"?"":"warn")}>{r.verification_status}</span></td><td><a className="btn" target="_blank" href={"/app/receipts/"+r.id+"/print"}>Štampa/PDF</a></td></tr>)}
        </tbody></table></div>
      </div>
    </>}

    {scan && activeOrg && <div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setScan(false)}}><div className="modal"><div className="modal-head"><div><span className="pill">NOVI RAČUN</span><h2>Skeniraj QR</h2></div><button className="btn" onClick={()=>setScan(false)}>Zatvori</button></div><QrScanner organizationId={activeOrg.organization_id} onDone={()=>{setScan(false);router.refresh()}}/></div></div>}
  </Shell>
}

function Shell({profile,children}:any){
  return <div className="app-shell"><header className="appbar"><div className="container appbar-in"><a className="brand" href="/app"><span className="logo">F</span><span>Fiskalni Inbox</span></a><div className="actions"><span className="muted" style={{alignSelf:"center",fontSize:12}}>{profile.username}</span><form method="post" action="/api/auth/logout"><button className="btn">Odjava</button></form></div></div></header><main className="container app-main">{children}</main></div>
}
function Stat({label,value}:any){return <div className="card stat"><span>{label}</span><strong>{value}</strong></div>}
function Onboarding(){return <div className="card" style={{padding:30,maxWidth:650}}><span className="pill">PRVI KORAK</span><h2>Kreirajte firmu</h2><p className="muted">Nalog je aktivan, ali još nije povezan sa firmom. Kreiranje firme je dostupno kroz setup API u ovoj V2 verziji.</p><a className="btn btn-primary" href="/app/setup">Podesi firmu</a></div>}
