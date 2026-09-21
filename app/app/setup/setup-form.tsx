"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
export default function SetupForm(){
  const [name,setName]=useState("");const [pib,setPib]=useState("");const [plan,setPlan]=useState("basic");const [err,setErr]=useState("");const router=useRouter();
  async function save(e:React.FormEvent){e.preventDefault();setErr("");const r=await fetch("/api/org/create",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,pib,plan})});const d=await r.json();if(!r.ok){setErr(d.error||"Greška");return}router.push("/app?org="+d.id);router.refresh()}
  return <form onSubmit={save}><div className="field"><label>Naziv firme</label><input className="input" value={name} onChange={e=>setName(e.target.value)} required/></div><div className="field"><label>PIB</label><input className="input" value={pib} onChange={e=>setPib(e.target.value)}/></div><div className="field"><label>Paket</label><select className="select" value={plan} onChange={e=>setPlan(e.target.value)}><option value="basic">Basic — 1.250 RSD / korisnik</option><option value="premium">Premium — 2.000 RSD / korisnik</option></select></div>{err&&<div className="error">{err}</div>}<button className="btn btn-primary" style={{width:"100%",marginTop:16}}>Kreiraj firmu</button></form>
}
