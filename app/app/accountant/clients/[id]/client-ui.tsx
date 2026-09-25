"use client";

import React, {useMemo, useState} from "react";
import { Archive, CheckCircle2, Download, Eye, FileText, MessageSquare, Printer, ReceiptText, Send, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import BrandWordmark from "@/components/BrandWordmark";
import AccountantDesktopMenu from "@/components/AccountantDesktopMenu";

const money=(v:any)=>new Intl.NumberFormat("sr-RS",{style:"currency",currency:"RSD"}).format(Number(v||0));
const dt=(v:any)=>v?new Intl.DateTimeFormat("sr-RS",{dateStyle:"short",timeStyle:"short"}).format(new Date(v)):"—";
function ym(value:any){if(!value)return "";const d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`}
function yy(value:any){if(!value)return "";const d=new Date(value);return Number.isNaN(d.getTime())?"":String(d.getFullYear())}
function monthLabel(value:string){const [y,m]=value.split("-").map(Number);return new Intl.DateTimeFormat("sr-RS",{month:"long",year:"numeric"}).format(new Date(y,m-1,1))}
function yearLabel(value:string){return `Cela ${value}. godina`}

export default function ClientWorkspace({organization,selectedMonth,selectedYear,receipts,documents,receiptStatuses,documentStatuses}:any){
  const router=useRouter();
  const [tab,setTab]=useState<"receipts"|"documents"|"send"|"vat">("receipts");
  const [sendFile,setSendFile]=useState<File|null>(null);
  const [includePushMessage,setIncludePushMessage]=useState(false);
  const [pushMessage,setPushMessage]=useState("");
  const [sendBusy,setSendBusy]=useState(false);
  const [sendStatus,setSendStatus]=useState("");
  const [rStatus,setRStatus]=useState<any[]>(receiptStatuses||[]);
  const [dStatus,setDStatus]=useState<any[]>(documentStatuses||[]);
  React.useEffect(()=>{const onFocus=()=>router.refresh();window.addEventListener("focus",onFocus);return()=>window.removeEventListener("focus",onFocus)},[router]);
  const rMap=useMemo<Map<string,any>>(()=>new Map(rStatus.map((s:any)=>[String(s.receipt_id),s])),[rStatus]);
  const dMap=useMemo<Map<string,any>>(()=>new Map(dStatus.map((s:any)=>[String(s.document_id),s])),[dStatus]);
  const activeYear=String(selectedYear||selectedMonth.slice(0,4));
  const isYearView=Boolean(selectedYear);
  const monthReceipts=useMemo(()=>receipts.filter((r:any)=>isYearView?yy(r.sdc_time||r.created_at)===activeYear:ym(r.sdc_time||r.created_at)===selectedMonth),[receipts,isYearView,activeYear,selectedMonth]);
  const monthDocuments=useMemo(()=>documents.filter((d:any)=>isYearView?yy(d.sent_at||d.created_at)===activeYear:ym(d.sent_at||d.created_at)===selectedMonth),[documents,isYearView,activeYear,selectedMonth]);
  const archiveMonths=useMemo(()=>Array.from(new Set<string>([
    ...receipts.map((r:any)=>ym(r.sdc_time||r.created_at)),...documents.map((d:any)=>ym(d.sent_at||d.created_at))
  ].filter(Boolean))).sort().reverse(),[receipts,documents]);
  const monthOptions=archiveMonths.includes(selectedMonth)?archiveMonths:[selectedMonth,...archiveMonths].sort().reverse();
  const availableYears=useMemo(()=>Array.from(new Set<string>([
    activeYear, ...archiveMonths.map((m:string)=>m.slice(0,4))
  ].filter(Boolean))).sort().reverse(),[activeYear,archiveMonths]);
  const periodLabel=isYearView?yearLabel(activeYear):monthLabel(selectedMonth);
  const rawVat=monthReceipts.reduce((s:number,r:any)=>s+Number(r.total_tax||0),0);
  const vat=monthReceipts.reduce((s:number,r:any)=>s+(r.vat_deductible===true?Number(r.total_tax||0):0),0);
  const vatPending=monthReceipts.filter((r:any)=>Number(r.total_tax||0)>0 && typeof r.vat_deductible!=="boolean").length;
  const gross=monthReceipts.reduce((s:number,r:any)=>s+Number(r.total_amount||0),0);
  const net=gross-rawVat;
  const downloadedR=monthReceipts.filter((r:any)=>rMap.get(String(r.id))?.downloaded_at).length;
  const downloadedD=monthDocuments.filter((d:any)=>dMap.get(String(d.id))?.downloaded_at).length;

  async function receiptEvent(id:string,action:"open"|"download"|"print"){
    const res=await fetch("/api/accountant/receipt-event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({receipt_id:id,action})});
    const data=await res.json();if(res.ok&&data.status)setRStatus(old=>[...old.filter((x:any)=>String(x.receipt_id)!==id),data.status]);
  }
  function openReceipt(r:any,mode:"download"|"print"){
    void receiptEvent(String(r.id),mode);
    const suffix=mode==="print"?"?review=1&autoprint=1":"?review=1";
    window.open(`/app/receipts/${r.id}/print${suffix}`,"_blank","noopener,noreferrer");
  }
  function downloadAll(type:"receipts"|"documents"){
    const periodQuery=isYearView?`year=${encodeURIComponent(activeYear)}`:`month=${encodeURIComponent(selectedMonth)}`;
    window.open(`/api/accountant/clients/${organization.id}/download-all?type=${type}&${periodQuery}`,"_blank","noopener,noreferrer");
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

  async function sendDocumentToClient(e:React.FormEvent){
    e.preventDefault();
    if(!sendFile){setSendStatus("Izaberite dokument.");return;}
    if(sendFile.size>20*1024*1024){setSendStatus("Maksimalna veličina dokumenta je 20 MB.");return;}
    setSendBusy(true);setSendStatus("");
    try{
      const form=new FormData();
      form.append("file",sendFile);
      if(includePushMessage&&pushMessage.trim())form.append("push_message",pushMessage.trim());
      const r=await fetch(`/api/accountant/clients/${organization.id}/send-document`,{method:"POST",body:form});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||"Dokument nije poslat.");
      setSendFile(null);setPushMessage("");setIncludePushMessage(false);
      setSendStatus("Dokument je poslat klijentu, sačuvan u arhivi i notifikacija je poslata.");
      const input=document.getElementById("accountant-client-send-file") as HTMLInputElement|null;if(input)input.value="";
      router.refresh();
    }catch(err:any){setSendStatus(err?.message||"Dokument nije poslat.");}
    finally{setSendBusy(false);}
  }

  return <div className="app-shell accountant-shell"><header className="appbar"><div className="container appbar-in"><a className="brand" href="/app"><span className="logo">F</span><BrandWordmark suffix=" · KNJIGO"/></a><a className="btn" href="/app">← Svi klijenti</a></div></header><div className="accountant-desktop-layout"><AccountantDesktopMenu/><main className="app-main accountant-main">
    <div className="app-head accountant-client-head"><div className="client-workspace-identity"><ClientHeaderLogo organization={organization}/><div><span className="pill">KLIJENT</span><h1 className="company-name-heading">{organization.name}</h1><p className="muted">PIB {organization.pib||"—"} · {organization.address||""}</p></div></div><label className="archive-select"><span>Obračunski period</span><select className="select" value={isYearView?`year:${activeYear}`:`month:${selectedMonth}`} onChange={e=>{const value=e.target.value;if(value.startsWith("year:"))router.push(`/app/accountant/clients/${organization.id}?year=${value.slice(5)}`);else router.push(`/app/accountant/clients/${organization.id}?month=${value.slice(6)}`)}}><optgroup label="Godišnji pregled">{availableYears.map((y:string)=><option key={`year-${y}`} value={`year:${y}`}>{yearLabel(y)}</option>)}</optgroup><optgroup label="Mesečni pregled">{monthOptions.map((m:string)=><option key={m} value={`month:${m}`}>{monthLabel(m)}</option>)}</optgroup></select></label></div>

    <div className="grid client-period-stats"><MiniStat label="Primljeni računi" value={monthReceipts.length}/><MiniStat label="Preuzeti računi" value={downloadedR}/><MiniStat label="Primljeni dokumenti" value={monthDocuments.length}/><MiniStat label="Preuzeti dokumenti" value={downloadedD}/><MiniStat label="Ulazni PDV" value={money(vat)}/></div>

    <div className="accountant-tabs"><button className={tab==="receipts"?"active":""} onClick={()=>setTab("receipts")}><ReceiptText size={17}/> Računi</button><button className={tab==="documents"?"active":""} onClick={()=>setTab("documents")}><FileText size={17}/> Dokumenti</button><button className={tab==="send"?"active":""} onClick={()=>setTab("send")}><Send size={17}/> Pošalji dokument</button><button className={tab==="vat"?"active":""} onClick={()=>setTab("vat")}><Archive size={17}/> Ulazni PDV / arhiva</button></div>

    {tab==="receipts"&&<div className="card table-card accountant-items"><div className="table-tools"><div><b>Primljeni fiskalni računi</b><div className="muted" style={{fontSize:12}}>{periodLabel}</div></div><button className="btn btn-primary" onClick={()=>downloadAll("receipts")} disabled={!monthReceipts.length}><Download size={15}/> Preuzmi sve račune</button></div><div className="table-wrap"><table><thead><tr><th>Datum</th><th>Dobavljač</th><th>Kategorija</th><th>PDV</th><th>Odbitni PDV</th><th>Iznos</th><th>Status</th><th>Akcije</th></tr></thead><tbody>{monthReceipts.map((r:any)=>{const st:any=rMap.get(String(r.id));return <tr key={r.id}><td>{dt(r.sdc_time||r.created_at)}</td><td><b>{r.merchant_name||"—"}</b><div className="mono muted" style={{fontSize:10}}>{r.invoice_number||""}</div>{r.bookkeeping_eligible===false&&<div className="receipt-pib-warning">BEZ PIB KUPCA · ARHIVA</div>}</td><td>{r.category||"Ostalo"}</td><td>{money(r.total_tax)}</td><td><VatDecisionBadge receipt={r}/></td><td><b>{money(r.total_amount)}</b></td><td><ItemStatus status={st}/></td><td><div className="item-actions"><button className="btn" onClick={()=>openReceipt(r,"download")}><Download size={15}/> Preuzmi / PDF</button><button className={`btn receipt-print-btn ${st?.printed_at?"is-printed":"is-unprinted"}`} onClick={()=>openReceipt(r,"print")} title={st?.printed_at?`Štampano ${dt(st.printed_at)}`:"Račun još nije štampan"}><Printer size={15}/> Štampaj</button></div></td></tr>})}{monthReceipts.length===0&&<tr><td colSpan={8}><div className="empty-state">Nema primljenih računa za izabrani period.</div></td></tr>}</tbody></table></div></div>}

    {tab==="documents"&&<div className="card files-panel accountant-documents"><div className="files-toolbar"><div><b>Primljeni dokumenti</b><div className="muted" style={{fontSize:12}}>{periodLabel}</div></div><button className="btn btn-primary" onClick={()=>downloadAll("documents")} disabled={!monthDocuments.length}><Download size={15}/> Preuzmi sve dokumente</button></div><div className="files-list">{monthDocuments.map((d:any)=>{const st:any=dMap.get(String(d.id));return <div className="file-row accountant-file-row" key={d.id}><div className="file-type-icon"><FileText size={20}/></div><div className="file-main"><b>{d.file_name}</b><span>Primljeno {dt(d.sent_at||d.created_at)}</span></div><div className="accountant-file-status"><ItemStatus status={st}/></div><div className="item-actions"><button className="btn" onClick={()=>openDocument(d,"view")}><Eye size={15}/> Otvori</button><button className="btn" onClick={()=>openDocument(d,"download")}><Download size={15}/> Preuzmi</button></div></div>})}{monthDocuments.length===0&&<div className="files-empty"><FileText/><b>Nema dokumenata za izabrani period.</b></div>}</div></div>}

    {tab==="send"&&<div className="card accountant-send-document-card"><div className="section-title"><div><span className="pill"><Send size={13}/> POŠALJI KLIJENTU</span><h3>Pošalji dokument</h3><p className="muted">Dokument se odmah dostavlja klijentu i automatski čuva u njegovoj FiscalBox arhivi.</p></div></div><form className="accountant-send-document-form" onSubmit={sendDocumentToClient}><label className="accountant-upload-drop"><Upload size={28}/><div><b>{sendFile?sendFile.name:"Izaberite dokument"}</b><span>PDF, Word, Excel, XML, CSV, slike i drugi poslovni dokumenti · do 20 MB</span></div><input id="accountant-client-send-file" type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.xml,.txt,.zip" onChange={e=>setSendFile(e.target.files?.[0]||null)} /></label><label className="accountant-push-message-toggle"><input type="checkbox" checked={includePushMessage} onChange={e=>setIncludePushMessage(e.target.checked)}/><MessageSquare size={17}/><div><b>Dodaj poruku u PUSH obaveštenje</b><span>Klijent će uz obaveštenje o novom fajlu videti i ovu poruku.</span></div></label>{includePushMessage&&<div className="field"><label>Poruka za klijenta</label><textarea className="input accountant-message-textarea" value={pushMessage} onChange={e=>setPushMessage(e.target.value)} maxLength={500} placeholder="Na primer: Molim vas potpišite dokument i vratite do petka."/></div>}{sendStatus&&<div className="demo-box">{sendStatus}</div>}<button className="btn btn-primary" disabled={sendBusy||!sendFile}><Send size={16}/> {sendBusy?"Šaljem…":"Pošalji dokument klijentu"}</button></form></div>}

    {tab==="vat"&&<div className="vat-archive-grid"><div className="card vat-summary-card"><span className="pill">ULAZNI PDV · KONAČNA ODLUKA KNJIGOVOĐE</span><h2>{money(vat)}</h2><p className="muted">U zbir ulazi samo PDV sa računa za koje je knjigovođa doneo konačnu odluku <b>PDV DA</b>. {vatPending?`Čeka odluku: ${vatPending} računa.`:"Nema računa koji čekaju PDV odluku."}</p><div className="vat-summary-lines"><div><span>Bruto iznos računa</span><b>{money(gross)}</b></div><div><span>PDV na računima</span><b>{money(rawVat)}</b></div><div><span>Prihvaćen ulazni PDV</span><b>{money(vat)}</b></div><div><span>Osnovica / iznos bez PDV (izvedeno)</span><b>{money(net)}</b></div></div></div><div className="card archive-card"><div className="section-title"><div><span className="pill"><Archive size={13}/> ARHIVA</span><h3>Godišnji i mesečni periodi</h3></div></div><div className="archive-months">{availableYears.map((y:string)=><a key={`archive-year-${y}`} className={isYearView&&y===activeYear?"active":""} href={`/app/accountant/clients/${organization.id}?year=${y}`}><b>{yearLabel(y)}</b> <span>→</span></a>)}{monthOptions.map((m:string)=><a key={m} className={!isYearView&&m===selectedMonth?"active":""} href={`/app/accountant/clients/${organization.id}?month=${m}`}>{monthLabel(m)} <span>→</span></a>)}</div></div></div>}
  </main></div></div>;
}

function ItemStatus({status}:any){if(status?.downloaded_at)return <span className="item-state done"><CheckCircle2 size={13}/> PREUZET</span>;if(status?.opened_at)return <span className="item-state opened"><Eye size={13}/> OTVOREN</span>;return <span className="item-state new">NOV / NEPREUZET</span>}
function MiniStat({label,value}:any){return <div className="card mini-stat"><span>{label}</span><strong>{value}</strong></div>}

function VatDecisionBadge({receipt}:any){
  if(receipt.vat_deductible===true)return <span className="vat-decision-badge final-yes">PDV DA</span>;
  if(receipt.vat_deductible===false)return <span className="vat-decision-badge final-no">PDV NE</span>;
  const ai=String(receipt.ai_vat_recommendation||"");
  if(ai==="da")return <span className="vat-decision-badge ai-yes">AI: DA · čeka potvrdu</span>;
  if(ai==="ne")return <span className="vat-decision-badge ai-no">AI: NE · čeka potvrdu</span>;
  if(ai==="provera")return <span className="vat-decision-badge ai-review">AI: PROVERA</span>;
  return <span className="vat-decision-badge pending">Čeka pregled</span>;
}

function ClientHeaderLogo({organization}:any){const [bad,setBad]=React.useState(false);return <div className="client-header-logo">{organization.logo_path&&!bad?<img src={`/api/org/logo?organization_id=${organization.id}`} onError={()=>setBad(true)} alt=""/>:<span>{String(organization.name||"K").slice(0,1)}</span>}</div>}
