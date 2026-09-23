"use client";

import React, {useMemo, useState} from "react";
import { Archive, CheckCircle2, Download, Eye, FileText, Printer, ReceiptText } from "lucide-react";
import { useRouter } from "next/navigation";
import BrandWordmark from "@/components/BrandWordmark";
import AccountantDesktopMenu from "@/components/AccountantDesktopMenu";

const money=(v:any)=>new Intl.NumberFormat("sr-RS",{style:"currency",currency:"RSD"}).format(Number(v||0));
const dt=(v:any)=>v?new Intl.DateTimeFormat("sr-RS",{dateStyle:"short",timeStyle:"short"}).format(new Date(v)):"—";
function ym(value:any){if(!value)return "";const d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`}
function monthLabel(value:string){const [y,m]=value.split("-").map(Number);return new Intl.DateTimeFormat("sr-RS",{month:"long",year:"numeric"}).format(new Date(y,m-1,1))}

export default function ClientWorkspace({organization,selectedMonth,receipts,documents,receiptStatuses,documentStatuses}:any){
  const router=useRouter();
  const [tab,setTab]=useState<"receipts"|"documents"|"vat">("receipts");
  const [rStatus,setRStatus]=useState<any[]>(receiptStatuses||[]);
  const [dStatus,setDStatus]=useState<any[]>(documentStatuses||[]);
  const rMap=useMemo<Map<string,any>>(()=>new Map(rStatus.map((s:any)=>[String(s.receipt_id),s])),[rStatus]);
  const dMap=useMemo<Map<string,any>>(()=>new Map(dStatus.map((s:any)=>[String(s.document_id),s])),[dStatus]);
  const monthReceipts=useMemo(()=>receipts.filter((r:any)=>ym(r.sdc_time||r.created_at)===selectedMonth),[receipts,selectedMonth]);
  const monthDocuments=useMemo(()=>documents.filter((d:any)=>ym(d.sent_at||d.created_at)===selectedMonth),[documents,selectedMonth]);
  const archiveMonths=useMemo(()=>Array.from(new Set<string>([
    ...receipts.map((r:any)=>ym(r.sdc_time||r.created_at)),...documents.map((d:any)=>ym(d.sent_at||d.created_at))
  ].filter(Boolean))).sort().reverse(),[receipts,documents]);
  const monthOptions=archiveMonths.includes(selectedMonth)?archiveMonths:[selectedMonth,...archiveMonths].sort().reverse();
  const vat=monthReceipts.reduce((s:number,r:any)=>s+Number(r.total_tax||0),0);
  const gross=monthReceipts.reduce((s:number,r:any)=>s+Number(r.total_amount||0),0);
  const net=gross-vat;
  const downloadedR=monthReceipts.filter((r:any)=>rMap.get(String(r.id))?.downloaded_at).length;
  const downloadedD=monthDocuments.filter((d:any)=>dMap.get(String(d.id))?.downloaded_at).length;

  async function receiptEvent(id:string,action:"open"|"download"|"print"){
    const res=await fetch("/api/accountant/receipt-event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({receipt_id:id,action})});
    const data=await res.json();if(res.ok&&data.status)setRStatus(old=>[...old.filter((x:any)=>String(x.receipt_id)!==id),data.status]);
  }
  function openReceipt(r:any,mode:"download"|"print"){
    void receiptEvent(String(r.id),mode);
    const suffix=mode==="print"?"?autoprint=1":"";
    window.open(`/app/receipts/${r.id}/print${suffix}`,"_blank","noopener,noreferrer");
  }
  function openDocument(d:any,mode:"view"|"download"){
    const now=new Date().toISOString();
    setDStatus(old=>{
      const prev=old.find((x:any)=>String(x.document_id)===String(d.id))||{};
      const next={...prev,document_id:d.id,organization_id:organization.id,opened_at:prev.opened_at||now,downloaded_at:mode==="download"?now:prev.downloaded_at||null};
      return [...old.filter((x:any)=>String(x.document_id)!==String(d.id)),next];
    });
    window.open(`/api/documents/${d.id}/download?mode=${mode}`,"_blank","noopener,noreferrer");
  }

  return <div className="app-shell accountant-shell"><header className="appbar"><div className="container appbar-in"><a className="brand" href="/app"><span className="logo">F</span><BrandWordmark suffix=" · KNJIGO"/></a><a className="btn" href="/app">← Svi klijenti</a></div></header><div className="accountant-desktop-layout"><AccountantDesktopMenu/><main className="app-main accountant-main">
    <div className="app-head accountant-client-head"><div className="client-workspace-identity"><ClientHeaderLogo organization={organization}/><div><span className="pill">KLIJENT</span><h1 className="company-name-heading">{organization.name}</h1><p className="muted">PIB {organization.pib||"—"} · {organization.address||""}</p></div></div><label className="archive-select"><span>Obračunski mesec</span><select className="select" value={selectedMonth} onChange={e=>router.push(`/app/accountant/clients/${organization.id}?month=${e.target.value}`)}>{monthOptions.map((m:string)=><option key={m} value={m}>{monthLabel(m)}</option>)}</select></label></div>

    <div className="grid client-period-stats"><MiniStat label="Primljeni računi" value={monthReceipts.length}/><MiniStat label="Preuzeti računi" value={downloadedR}/><MiniStat label="Primljeni dokumenti" value={monthDocuments.length}/><MiniStat label="Preuzeti dokumenti" value={downloadedD}/><MiniStat label="Ulazni PDV" value={money(vat)}/></div>

    <div className="accountant-tabs"><button className={tab==="receipts"?"active":""} onClick={()=>setTab("receipts")}><ReceiptText size={17}/> Računi</button><button className={tab==="documents"?"active":""} onClick={()=>setTab("documents")}><FileText size={17}/> Dokumenti</button><button className={tab==="vat"?"active":""} onClick={()=>setTab("vat")}><Archive size={17}/> Ulazni PDV / arhiva</button></div>

    {tab==="receipts"&&<div className="card table-card accountant-items"><div className="table-tools"><div><b>Primljeni fiskalni računi</b><div className="muted" style={{fontSize:12}}>{monthLabel(selectedMonth)}</div></div></div><div className="table-wrap"><table><thead><tr><th>Datum</th><th>Dobavljač</th><th>Kategorija</th><th>PDV</th><th>Iznos</th><th>Status</th><th>Akcije</th></tr></thead><tbody>{monthReceipts.map((r:any)=>{const st:any=rMap.get(String(r.id));return <tr key={r.id}><td>{dt(r.sdc_time||r.created_at)}</td><td><b>{r.merchant_name||"—"}</b><div className="mono muted" style={{fontSize:10}}>{r.invoice_number||""}</div></td><td>{r.category||"Ostalo"}</td><td>{money(r.total_tax)}</td><td><b>{money(r.total_amount)}</b></td><td><ItemStatus status={st}/></td><td><div className="item-actions"><button className="btn" onClick={()=>openReceipt(r,"download")}><Download size={15}/> Preuzmi / PDF</button><button className="btn" onClick={()=>openReceipt(r,"print")}><Printer size={15}/> Štampaj</button></div></td></tr>})}{monthReceipts.length===0&&<tr><td colSpan={7}><div className="empty-state">Nema primljenih računa za izabrani mesec.</div></td></tr>}</tbody></table></div></div>}

    {tab==="documents"&&<div className="card files-panel accountant-documents"><div className="files-toolbar"><div><b>Primljeni dokumenti</b><div className="muted" style={{fontSize:12}}>{monthLabel(selectedMonth)}</div></div></div><div className="files-list">{monthDocuments.map((d:any)=>{const st:any=dMap.get(String(d.id));return <div className="file-row accountant-file-row" key={d.id}><div className="file-type-icon"><FileText size={20}/></div><div className="file-main"><b>{d.file_name}</b><span>Primljeno {dt(d.sent_at||d.created_at)}</span></div><div className="accountant-file-status"><ItemStatus status={st}/></div><div className="item-actions"><button className="btn" onClick={()=>openDocument(d,"view")}><Eye size={15}/> Otvori</button><button className="btn" onClick={()=>openDocument(d,"download")}><Download size={15}/> Preuzmi</button></div></div>})}{monthDocuments.length===0&&<div className="files-empty"><FileText/><b>Nema dokumenata za izabrani mesec.</b></div>}</div></div>}

    {tab==="vat"&&<div className="vat-archive-grid"><div className="card vat-summary-card"><span className="pill">ULAZNI PDV · FISKALNI RAČUNI</span><h2>{money(vat)}</h2><p className="muted">Evidentirani PDV sa fiskalnih računa za {monthLabel(selectedMonth)}.</p><div className="vat-summary-lines"><div><span>Bruto iznos računa</span><b>{money(gross)}</b></div><div><span>PDV</span><b>{money(vat)}</b></div><div><span>Iznos bez PDV (izvedeno)</span><b>{money(net)}</b></div></div></div><div className="card archive-card"><div className="section-title"><div><span className="pill"><Archive size={13}/> ARHIVA</span><h3>Mesečni periodi</h3></div></div><div className="archive-months">{monthOptions.map((m:string)=><a key={m} className={m===selectedMonth?"active":""} href={`/app/accountant/clients/${organization.id}?month=${m}`}>{monthLabel(m)} <span>→</span></a>)}</div></div></div>}
  </main></div></div>;
}

function ItemStatus({status}:any){if(status?.downloaded_at)return <span className="item-state done"><CheckCircle2 size={13}/> PREUZET</span>;if(status?.opened_at)return <span className="item-state opened"><Eye size={13}/> OTVOREN</span>;return <span className="item-state new">NOV / NEPREUZET</span>}
function MiniStat({label,value}:any){return <div className="card mini-stat"><span>{label}</span><strong>{value}</strong></div>}

function ClientHeaderLogo({organization}:any){const [bad,setBad]=React.useState(false);return <div className="client-header-logo">{organization.logo_path&&!bad?<img src={`/api/org/logo?organization_id=${organization.id}`} onError={()=>setBad(true)} alt=""/>:<span>{String(organization.name||"K").slice(0,1)}</span>}</div>}
