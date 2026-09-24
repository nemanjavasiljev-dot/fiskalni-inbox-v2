"use client";

import React from "react";
import { BrainCircuit, CheckCircle2, CircleHelp, XCircle } from "lucide-react";

type Props={
  receiptId:string;
  recommendation:"da"|"ne"|"provera";
  confidence:number;
  reason:string;
  initialDecision:boolean|null;
};

export default function VatDecisionPanel({receiptId,recommendation,confidence,reason,initialDecision}:Props){
  const [decision,setDecision]=React.useState<boolean|null>(initialDecision);
  const [busy,setBusy]=React.useState(false);
  const [error,setError]=React.useState("");
  const [showClosePrompt,setShowClosePrompt]=React.useState(false);

  React.useEffect(()=>{
    if(decision!==null)return;
    const onBeforeUnload=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue="";};
    window.addEventListener("beforeunload",onBeforeUnload);
    return()=>window.removeEventListener("beforeunload",onBeforeUnload);
  },[decision]);

  async function save(value:boolean,closeAfter=false){
    setBusy(true);setError("");
    try{
      const r=await fetch("/api/accountant/receipt-vat-decision",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({receipt_id:receiptId,vat_deductible:value})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.error||"Odluka nije sačuvana.");
      setDecision(value);setShowClosePrompt(false);
      if(closeAfter){
        setTimeout(()=>{try{window.close()}catch{};if(!window.closed)history.back();},120);
      }
    }catch(e:any){setError(e?.message||"Odluka nije sačuvana.");}
    finally{setBusy(false);}
  }

  function closeReceipt(){
    if(decision===null){setShowClosePrompt(true);return;}
    try{window.close()}catch{}
    if(!window.closed)history.back();
  }

  const meta=recommendation==="da"
    ? {label:"AI predlog: PDV DA",cls:"yes",icon:<CheckCircle2 size={18}/>}
    : recommendation==="ne"
      ? {label:"AI predlog: PDV NE",cls:"no",icon:<XCircle size={18}/>}
      : {label:"AI predlog: PROVERA",cls:"review",icon:<CircleHelp size={18}/>};

  return <div className="no-print vat-review-shell">
    <div className={`vat-ai-card ${meta.cls}`}>
      <div className="vat-ai-title"><BrainCircuit size={19}/><b>{meta.label}</b><span>{confidence}% sigurnost</span></div>
      <p>{reason}</p>
      <small>AI daje preporuku na osnovu delatnosti firme, podataka i stavki računa. Konačnu odluku donosi knjigovođa.</small>
    </div>
    <div className="vat-final-card">
      <div><b>Konačna odluka knjigovođe</b><span>{decision===null?"Nije doneta":decision?"Ulazni PDV: DA":"Ulazni PDV: NE"}</span></div>
      <div className="vat-final-actions">
        <button type="button" className={`btn vat-yes ${decision===true?"active":""}`} disabled={busy} onClick={()=>void save(true)}><CheckCircle2 size={16}/> PDV DA</button>
        <button type="button" className={`btn vat-no ${decision===false?"active":""}`} disabled={busy} onClick={()=>void save(false)}><XCircle size={16}/> PDV NE</button>
        <button type="button" className="btn" disabled={busy} onClick={closeReceipt}>Zatvori račun</button>
      </div>
    </div>
    {error&&<div className="error" style={{marginTop:8}}>{error}</div>}
    {showClosePrompt&&<div className="vat-close-overlay" role="dialog" aria-modal="true">
      <div className="vat-close-modal">
        <span className="pill">OBAVEZNA ODLUKA</span>
        <h3>Da li se PDV sa ovog računa koristi kao ulazni PDV?</h3>
        <p>AI predlog je <b>{recommendation==="da"?"DA":recommendation==="ne"?"NE":"PROVERA"}</b>. Vi donosite konačnu odluku.</p>
        <div className="vat-close-actions">
          <button className="btn vat-yes" disabled={busy} onClick={()=>void save(true,true)}>PDV DA</button>
          <button className="btn vat-no" disabled={busy} onClick={()=>void save(false,true)}>PDV NE</button>
          <button className="btn" disabled={busy} onClick={()=>setShowClosePrompt(false)}>Vrati se na račun</button>
        </div>
      </div>
    </div>}
    <style jsx global>{`
      .vat-review-shell{margin:14px 0 18px;display:grid;gap:10px}.vat-ai-card,.vat-final-card{border:1px solid #dfe7e3;border-radius:14px;padding:14px 16px;background:#fff}.vat-ai-card.yes{background:#eefaf3;border-color:#a9dfbd}.vat-ai-card.no{background:#fff1f1;border-color:#efb5b5}.vat-ai-card.review{background:#fff8e8;border-color:#e7ca87}.vat-ai-title{display:flex;align-items:center;gap:8px}.vat-ai-title span{margin-left:auto;font-size:11px;font-weight:800}.vat-ai-card p{margin:8px 0 5px;font-size:12px;line-height:1.45}.vat-ai-card small{color:#5d6863}.vat-final-card{display:flex;align-items:center;justify-content:space-between;gap:14px}.vat-final-card>div:first-child{display:grid;gap:3px}.vat-final-card span{font-size:12px;color:#65726c}.vat-final-actions{display:flex;gap:8px;flex-wrap:wrap}.vat-yes{border-color:#75bd91!important;background:#eefaf3!important;color:#0b6a42!important}.vat-yes.active{background:#0d6b4a!important;color:white!important}.vat-no{border-color:#e5a2a2!important;background:#fff0f0!important;color:#9d2a2a!important}.vat-no.active{background:#a83434!important;color:white!important}.vat-close-overlay{position:fixed;inset:0;background:rgba(12,28,23,.48);display:grid;place-items:center;z-index:9999;padding:20px}.vat-close-modal{width:min(520px,100%);background:white;border-radius:18px;padding:24px;box-shadow:0 24px 80px rgba(0,0,0,.25)}.vat-close-modal h3{margin:14px 0 8px;font-size:21px}.vat-close-modal p{color:#5e6b65}.vat-close-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}@media(max-width:700px){.vat-final-card{align-items:flex-start;flex-direction:column}.vat-final-actions{width:100%}.vat-final-actions .btn{flex:1}.vat-close-actions{display:grid}.vat-close-actions .btn{width:100%}}
    `}</style>
  </div>;
}
