"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupForm(){
  const router=useRouter();
  const [lookup,setLookup]=useState("");
  const [lookupBusy,setLookupBusy]=useState(false);
  const [lookupMessage,setLookupMessage]=useState("");
  const [manual,setManual]=useState(false);
  const [plan,setPlan]=useState("basic");
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState("");
  const [company,setCompany]=useState<any>({name:"",pib:"",registration_number:"",legal_form:"",address:"",municipality:"",activity_code:"",activity_name:"",apr_raw:null});

  function field(key:string,value:string){setCompany((c:any)=>({...c,[key]:value}));}

  async function findCompany(){
    setLookupBusy(true);setLookupMessage("");setErr("");
    try{
      const r=await fetch("/api/apr/lookup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:lookup})});
      const d=await r.json();
      if(!r.ok) throw new Error(d.error||"APR pretraga nije uspela.");
      setCompany({...company,...d.company});setManual(true);setLookupMessage("Podaci firme su pronađeni. Proverite ih i potvrdite.");
    }catch(e:any){setLookupMessage(e.message||"APR pretraga nije uspela.");setManual(true);}
    finally{setLookupBusy(false);}
  }

  async function save(e:React.FormEvent){
    e.preventDefault();setErr("");setSaving(true);
    try{
      const r=await fetch("/api/org/create",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...company,plan})});
      const d=await r.json();
      if(!r.ok) throw new Error(d.error||"Kreiranje firme nije uspelo.");
      router.push("/app?org="+d.id);router.refresh();
    }catch(e:any){setErr(e.message||"Greška pri kreiranju firme.");}
    finally{setSaving(false);}
  }

  return <>
    <div className="setup-lookup">
      <div className="field"><label>PIB ili matični broj</label><div className="lookup-row"><input className="input" inputMode="numeric" value={lookup} onChange={e=>setLookup(e.target.value.replace(/\D/g,""))} placeholder="PIB 9 cifara ili MB 8 cifara" maxLength={9}/><button type="button" className="btn btn-primary" onClick={findCompany} disabled={lookupBusy||![8,9].includes(lookup.length)}>{lookupBusy?"Tražim…":"Povuci iz APR-a"}</button></div></div>
      {lookupMessage&&<div className="lookup-message">{lookupMessage}</div>}
      {!manual&&<button type="button" className="manual-link" onClick={()=>setManual(true)}>Unesi podatke ručno</button>}
    </div>

    {manual&&<form onSubmit={save} className="setup-company-form">
      <div className="setup-grid">
        <div className="field setup-wide"><label>Naziv firme</label><input className="input" value={company.name} onChange={e=>field("name",e.target.value)} required/></div>
        <div className="field"><label>PIB</label><input className="input" value={company.pib} onChange={e=>field("pib",e.target.value.replace(/\D/g,""))} maxLength={9}/></div>
        <div className="field"><label>Matični broj</label><input className="input" value={company.registration_number} onChange={e=>field("registration_number",e.target.value.replace(/\D/g,""))} maxLength={8}/></div>
        <div className="field"><label>Pravna forma</label><input className="input" value={company.legal_form} onChange={e=>field("legal_form",e.target.value)}/></div>
        <div className="field"><label>Opština</label><input className="input" value={company.municipality} onChange={e=>field("municipality",e.target.value)}/></div>
        <div className="field setup-wide"><label>Adresa sedišta</label><input className="input" value={company.address} onChange={e=>field("address",e.target.value)}/></div>
        <div className="field"><label>Šifra delatnosti</label><input className="input" value={company.activity_code} onChange={e=>field("activity_code",e.target.value)}/></div>
        <div className="field"><label>Naziv delatnosti</label><input className="input" value={company.activity_name} onChange={e=>field("activity_name",e.target.value)}/></div>
        <div className="field setup-wide"><label>Paket</label><select className="select" value={plan} onChange={e=>setPlan(e.target.value)}><option value="basic">Basic — 1.250 RSD / korisnik</option><option value="premium">Premium — 2.000 RSD / korisnik</option></select></div>
      </div>
      {err&&<div className="error">{err}</div>}
      <button className="btn btn-primary" style={{width:"100%",marginTop:16}} disabled={saving}>{saving?"Kreiram firmu…":"Potvrdi i kreiraj firmu"}</button>
    </form>}
  </>;
}
