"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import QrScanner from "@/components/QrScanner";
import UserBottomNav from "@/components/UserBottomNav";

const demoReceipts=[
 {vendor:"NIS Petrol",pib:"100000111",category:"Gorivo",amount:8420,tax:1403,date:"18.09.2026",invoice:"PP-1842"},
 {vendor:"Gigatron",pib:"100000222",category:"IT oprema",amount:32990,tax:5498,date:"17.09.2026",invoice:"GT-32990"},
 {vendor:"Telekom Srbija",pib:"100000333",category:"Telekomunikacije",amount:14280,tax:2380,date:"15.09.2026",invoice:"TS-14280"}
];
export default function Demo(){
 const [session,setSession]=useState<any>(null);const router=useRouter();
 const [scan,setScan]=useState(false);const [searchOpen,setSearchOpen]=useState(false);const [moreOpen,setMoreOpen]=useState(false);const [query,setQuery]=useState("");
 const [navActive,setNavActive]=useState<"home"|"search"|"database"|"more">("home");
 const searchRef=useRef<HTMLInputElement>(null);const databaseRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{try{const s=JSON.parse(sessionStorage.getItem("fi_demo")||"null");if(!s)router.replace("/login?demo=1");else setSession(s)}catch{router.replace("/login?demo=1")}},[]);
 const filtered=useMemo(()=>{const q=query.trim().toLowerCase();if(!q)return demoReceipts;return demoReceipts.filter(r=>Object.values(r).some(v=>String(v).toLowerCase().includes(q)))},[query]);
 if(!session)return null;
 const role=session.role;
 const title=role==="master"?"Master Admin":role==="accountant"?"Knjigovođa":"Demo firma";
 const isCompany=role==="company";
 const goHome=()=>{setNavActive("home");setSearchOpen(false);setMoreOpen(false);window.scrollTo({top:0,behavior:"smooth"})};
 const openSearch=()=>{setNavActive("search");setSearchOpen(true);setMoreOpen(false);setTimeout(()=>searchRef.current?.focus(),80)};
 const openDatabase=()=>{setNavActive("database");setSearchOpen(false);setMoreOpen(false);databaseRef.current?.scrollIntoView({behavior:"smooth",block:"start"})};
 const openMore=()=>{setNavActive("more");setSearchOpen(false);setMoreOpen(true)};
 return <div className={`app-shell ${isCompany?"with-bottom-nav":""}`}><header className="appbar"><div className="container appbar-in"><a className="brand" href="/"><span className="logo">F</span><span>Fiskalni Inbox · DEMO</span></a><button className="btn" onClick={()=>{sessionStorage.removeItem("fi_demo");router.push("/")}}>Izađi iz demo-a</button></div></header><main className="container app-main">
  <div className="app-head"><div><span className="pill">{title.toUpperCase()}</span><h1>{role==="company"?"Demo Kompanija doo":title}</h1><p className="muted">Ovo su test podaci — nisu povezani sa stvarnim računima.</p></div>{isCompany&&<button className="btn btn-accent desktop-scan-btn" onClick={()=>setScan(true)}>Skeniraj QR</button>}</div>
  {role==="master"?<MasterDemo/>:<>{isCompany&&searchOpen&&<div className="card user-search-card"><div className="user-search-row"><span>⌕</span><input ref={searchRef} className="user-search-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Pretraži demo bazu…"/>{query&&<button className="user-search-clear" onClick={()=>setQuery("")}>×</button>}</div><div className="muted" style={{fontSize:12,marginTop:8}}>{query?`${filtered.length} rezultata`:"Pretražite demo račune."}</div></div>}
  <div className="grid stats"><Stat l="Računi" v="48"/><Stat l="Troškovi" v="318.540 RSD"/><Stat l="PDV" v="52.214 RSD"/><Stat l={role==="accountant"?"Klijenti":"Za proveru"} v={role==="accountant"?"6":"2"}/></div><Receipts receipts={isCompany?filtered:demoReceipts} refEl={databaseRef}/></>}
 </main>
 {isCompany&&scan&&<div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setScan(false)}}><div className="modal qr-modal"><div className="modal-head"><div><span className="pill">DEMO SKENER</span><h2>QR skener</h2></div><button className="btn" onClick={()=>setScan(false)}>Zatvori</button></div><p className="muted" style={{marginTop:0}}>Kamera i očitavanje rade; demo ne upisuje podatke u produkcionu bazu.</p><QrScanner demoMode onDone={()=>setScan(false)}/></div></div>}
 {isCompany&&moreOpen&&<div className="bottom-sheet-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setMoreOpen(false)}}><div className="bottom-sheet"><div className="bottom-sheet-handle"/><div className="bottom-sheet-head"><div><span className="pill">VIŠE</span><h3>Demo opcije</h3></div><button className="btn" onClick={()=>setMoreOpen(false)}>Zatvori</button></div><div className="more-list"><div className="more-info"><span>Nalog</span><b>user / user</b></div><div className="more-info"><span>Paket</span><b>PREMIUM DEMO</b></div><button className="more-action" onClick={()=>alert("Demo CSV izvoz će biti povezan sa stvarnom bazom u produkcionom nalogu.")}>CSV izvoz <b>→</b></button><button className="more-action danger" onClick={()=>{sessionStorage.removeItem("fi_demo");router.push("/")}}>Izađi iz demo-a <b>→</b></button></div></div></div>}
 {isCompany&&<UserBottomNav active={navActive} onHome={goHome} onSearch={openSearch} onScan={()=>setScan(true)} onDatabase={openDatabase} onMore={openMore}/>} 
 </div>
}
function Stat({l,v}:any){return <div className="card stat"><span>{l}</span><strong>{v}</strong></div>}
function Receipts({receipts,refEl}:any){return <div className="card table-card" ref={refEl}><div className="table-tools"><b>Baza fiskalnih računa</b><button className="btn">CSV demo</button></div><div className="table-wrap"><table><thead><tr><th>Datum</th><th>Dobavljač</th><th>PIB</th><th>Kategorija</th><th>PDV</th><th>Iznos</th><th>Status</th></tr></thead><tbody>{receipts.map((r:any)=><tr key={r.vendor}><td>{r.date}</td><td><b>{r.vendor}</b><div className="muted mono" style={{fontSize:10}}>{r.invoice}</div></td><td>{r.pib}</td><td>{r.category}</td><td>{r.tax.toLocaleString("sr-RS")} RSD</td><td><b>{r.amount.toLocaleString("sr-RS")} RSD</b></td><td><span className="badge">provereno</span></td></tr>)}{receipts.length===0&&<tr><td colSpan={7}><div className="empty-state">Nema demo računa koji odgovaraju pretrazi.</div></td></tr>}</tbody></table></div></div>}
function MasterDemo(){const clients=[["Cybershield doo","Premium",52,3,1],["Demo Trade doo","Basic",31,2,1],["Nova Office doo","Premium",74,5,2],["Servis Plus","Basic",19,1,1]];return <><div className="grid stats"><Stat l="Klijenti" v="24"/><Stat l="Knjigovođe" v="8"/><Stat l="Računi ovog meseca" v="1.248"/><Stat l="MRR" v="46.750 RSD"/></div><div className="grid client-grid" style={{marginTop:20}}>{clients.map(c=><div className="card client" key={String(c[0])}><span className="badge">{c[1]}</span><h3>{c[0]}</h3><div className="muted">Aktivan klijent</div><div className="kpis"><span>RAČUNI<b>{c[2]}</b></span><span>KORISNICI<b>{c[3]}</b></span><span>KNJIGOVOĐE<b>{c[4]}</b></span></div></div>)}</div></>}
