"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";

const demoReceipts=[
 {vendor:"NIS Petrol",category:"Gorivo",amount:8420,tax:1403,date:"18.09.2026"},
 {vendor:"Gigatron",category:"IT oprema",amount:32990,tax:5498,date:"17.09.2026"},
 {vendor:"Telekom Srbija",category:"Telekomunikacije",amount:14280,tax:2380,date:"15.09.2026"}
];
export default function Demo(){
 const [session,setSession]=useState<any>(null);const router=useRouter();
 useEffect(()=>{try{const s=JSON.parse(sessionStorage.getItem("fi_demo")||"null");if(!s)router.replace("/login?demo=1");else setSession(s)}catch{router.replace("/login?demo=1")}},[]);
 if(!session)return null;
 const role=session.role;
 const title=role==="master"?"Master Admin":role==="accountant"?"Knjigovođa":"Demo firma";
 return <div className="app-shell"><header className="appbar"><div className="container appbar-in"><a className="brand" href="/"><span className="logo">F</span><span>Fiskalni Inbox · DEMO</span></a><button className="btn" onClick={()=>{sessionStorage.removeItem("fi_demo");router.push("/")}}>Izađi iz demo-a</button></div></header><main className="container app-main">
  <div className="app-head"><div><span className="pill">{title.toUpperCase()}</span><h1>{role==="company"?"Demo Kompanija doo":title}</h1><p className="muted">Ovo su test podaci — nisu povezani sa stvarnim računima.</p></div></div>
  {role==="master"?<MasterDemo/>:<><div className="grid stats"><Stat l="Računi" v="48"/><Stat l="Troškovi" v="318.540 RSD"/><Stat l="PDV" v="52.214 RSD"/><Stat l={role==="accountant"?"Klijenti":"Za proveru"} v={role==="accountant"?"6":"2"}/></div><Receipts/></>}
 </main></div>
}
function Stat({l,v}:any){return <div className="card stat"><span>{l}</span><strong>{v}</strong></div>}
function Receipts(){return <div className="card table-card"><div className="table-tools"><b>Fiskalni računi</b><button className="btn">CSV demo</button></div><div className="table-wrap"><table><thead><tr><th>Datum</th><th>Dobavljač</th><th>Kategorija</th><th>PDV</th><th>Iznos</th><th>Status</th></tr></thead><tbody>{demoReceipts.map((r:any)=><tr key={r.vendor}><td>{r.date}</td><td><b>{r.vendor}</b></td><td>{r.category}</td><td>{r.tax.toLocaleString("sr-RS")} RSD</td><td><b>{r.amount.toLocaleString("sr-RS")} RSD</b></td><td><span className="badge">provereno</span></td></tr>)}</tbody></table></div></div>}
function MasterDemo(){const clients=[["Cybershield doo","Premium",52,3,1],["Demo Trade doo","Basic",31,2,1],["Nova Office doo","Premium",74,5,2],["Servis Plus","Basic",19,1,1]];return <><div className="grid stats"><Stat l="Klijenti" v="24"/><Stat l="Knjigovođe" v="8"/><Stat l="Računi ovog meseca" v="1.248"/><Stat l="MRR" v="46.750 RSD"/></div><div className="grid client-grid" style={{marginTop:20}}>{clients.map(c=><div className="card client" key={String(c[0])}><span className="badge">{c[1]}</span><h3>{c[0]}</h3><div className="muted">Aktivan klijent</div><div className="kpis"><span>RAČUNI<b>{c[2]}</b></span><span>KORISNICI<b>{c[3]}</b></span><span>KNJIGOVOĐE<b>{c[4]}</b></span></div></div>)}</div></>}
