"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, ImagePlus, Send, Sparkles, Users, ReceiptText, WalletCards, BadgePercent, Clock3 } from "lucide-react";
import QrScanner from "@/components/QrScanner";
import UserBottomNav from "@/components/UserBottomNav";
import BrandWordmark from "@/components/BrandWordmark";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { RECEIPT_CATEGORIES } from "@/lib/receipt-category";
import AccountantHome from "./accountant-home";
import MasterAdmin from "./master-admin";
import PushNotificationOptIn from "@/components/PushNotificationOptIn";
import { type CompanySearchValue } from "@/components/CompanySearch";
import CompanyLookup from "@/components/CompanyLookup";
import CompanyHeaderMenu from "@/components/CompanyHeaderMenu";

const money=(v:any)=>new Intl.NumberFormat("sr-RS",{style:"currency",currency:"RSD"}).format(Number(v||0));
const dt=(v:any)=>v?new Intl.DateTimeFormat("sr-RS",{dateStyle:"short"}).format(new Date(v)):"—";

function monthDueDate(){
  const now=new Date();
  const due=new Date(now.getFullYear(),now.getMonth()+1,0);
  return new Intl.DateTimeFormat("sr-RS",{dateStyle:"long"}).format(due);
}
function monthLabel(){return new Intl.DateTimeFormat("sr-RS",{month:"long",year:"numeric"}).format(new Date());}

export default function Dashboard({profile,organizations,activeOrg,receipts,master,accountantOverview,accountantContext,accessContext}:any) {
  const router=useRouter();
  const [receiptList,setReceiptList]=useState<any[]>(receipts||[]);
  const [scan,setScan]=useState(false);
  const [query,setQuery]=useState("");
  const [categoryFilter,setCategoryFilter]=useState("Sve");
  const [searchOpen,setSearchOpen]=useState(false);
  const [moreOpen,setMoreOpen]=useState(false);
  const [navActive,setNavActive]=useState<"home"|"search"|"files"|"more">("home");
  const [showAccountants,setShowAccountants]=useState(false);
  const [sendBusy,setSendBusy]=useState(false);
  const [homeMessage,setHomeMessage]=useState("");
  const [sendSchedule,setSendSchedule]=useState(String(activeOrg?.receipt_send_schedule||"manual"));
  const [settingsBusy,setSettingsBusy]=useState(false);
  const [settingsMessage,setSettingsMessage]=useState("");
  const [selectedAccountantCompany,setSelectedAccountantCompany]=useState<CompanySearchValue|null>(null);
  const [accountantLinkEmail,setAccountantLinkEmail]=useState(String(activeOrg?.accountant_contact_email||""));
  const [accountantLinkBusy,setAccountantLinkBusy]=useState(false);
  const [accountantLinkMessage,setAccountantLinkMessage]=useState("");
  const [logoAvailable,setLogoAvailable]=useState(Boolean(activeOrg?.logo_path));
  const [logoVersion,setLogoVersion]=useState(Date.now());
  const searchRef=useRef<HTMLInputElement>(null);
  const logoInputRef=useRef<HTMLInputElement>(null);

  useEffect(()=>{
    setReceiptList(receipts||[]);
    setSendSchedule(String(activeOrg?.receipt_send_schedule||"manual"));
    setSelectedAccountantCompany(null);
    setAccountantLinkEmail(String(activeOrg?.accountant_contact_email||""));
    setLogoAvailable(Boolean(activeOrg?.logo_path));
  },[receipts,activeOrg?.organization_id,activeOrg?.receipt_send_schedule,activeOrg?.accountant_contact_email,activeOrg?.logo_path]);

  const total=useMemo(()=>receiptList.reduce((s:any,r:any)=>s+Number(r.total_amount||0),0),[receiptList]);
  const tax=useMemo(()=>receiptList.reduce((s:any,r:any)=>s+Number(r.total_tax||0),0),[receiptList]);
  const needs=receiptList.filter((r:any)=>r.verification_status!=="provereno").length;
  const unsentCount=receiptList.filter((r:any)=>!r.sent_to_accountant_at).length;
  const categoryTotals=useMemo(()=>{
    const map=new Map<string,{count:number,total:number}>();
    receiptList.forEach((r:any)=>{
      const c=String(r.category||"Ostalo");
      const prev=map.get(c)||{count:0,total:0};
      map.set(c,{count:prev.count+1,total:prev.total+Number(r.total_amount||0)});
    });
    return Array.from(map.entries()).map(([category,value])=>({category,...value})).sort((a,b)=>b.total-a.total);
  },[receiptList]);
  const filteredReceipts=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return receiptList.filter((r:any)=>{
      const categoryOk=categoryFilter==="Sve"||String(r.category||"Ostalo")===categoryFilter;
      if(!categoryOk) return false;
      if(!q) return true;
      return [r.merchant_name,r.merchant_pib,r.invoice_number,r.category,r.note,r.payment_method].some(v=>String(v||"").toLowerCase().includes(q));
    });
  },[receiptList,query,categoryFilter]);

  if (profile.global_role==="master_admin" && master) return <MasterAdmin profile={profile} master={master}/>;

  if (accountantContext?.office?.status==="paused") return <ServiceBlocked profile={profile} reason={accountantContext.office.service_block_reason}/>;
  if (activeOrg?.status==="paused" && profile.global_role!=="master_admin") return <ServiceBlocked profile={profile} reason={activeOrg.service_block_reason}/>;

  if (accountantOverview && profile.global_role!=="master_admin") {
    return <AccountantHome profile={profile} organizations={organizations.filter((o:any)=>o.role==="accountant")} overview={accountantOverview} context={accountantContext}/>;
  }

  if (profile.global_role==="master_admin" && master) {
    const companyOrgs=master.organizations.filter((o:any)=>o.organization_type!=="accounting");
    const orgMap=new Map<string,any>(companyOrgs.map((o:any)=>[String(o.id),o]));
    const profileMap=new Map<string,any>(master.profiles.map((p:any)=>[String(p.user_id),p]));
    const companyUsersByOrg=new Map<string,number>();
    companyOrgs.forEach((o:any)=>{
      const seats=master.members.filter((m:any)=>m.organization_id===o.id && (m.role==="owner"||m.role==="employee")).length;
      companyUsersByOrg.set(String(o.id),Math.max(1,seats));
    });
    const accountantIds: string[] = Array.from(new Set<string>([
      ...master.members.filter((m:any)=>m.role==="accountant").map((m:any)=>String(m.user_id)),
      ...master.profiles.filter((p:any)=>p.global_role==="accountant").map((p:any)=>String(p.user_id))
    ]));
    const accountants=accountantIds.map((id:string)=>{
      const assignments=master.members.filter((m:any)=>m.role==="accountant"&&String(m.user_id)===id);
      const orgIds: string[] = Array.from(new Set<string>(assignments.map((m:any)=>String(m.organization_id))));
      const clients=orgIds.map((orgId:string)=>orgMap.get(orgId)).filter(Boolean);
      const users=orgIds.reduce((sum:number,orgId:string)=>{const o:any=orgMap.get(orgId); return sum+(o?(companyUsersByOrg.get(orgId)||0):0);},0);
      const p:any=profileMap.get(id)||{};
      return {id,name:p.full_name||p.username||p.auth_email||"Knjigovođa",email:p.auth_email||"",clients,users,payout:users*250};
    }).sort((a:any,b:any)=>b.payout-a.payout);
    const gross=companyOrgs.reduce((sum:number,o:any)=>sum+(companyUsersByOrg.get(String(o.id))||1)*(o.plan==="premium"?1790:1250),0);
    const payouts=accountants.reduce((sum:number,a:any)=>sum+a.payout,0);
    const profit=gross-payouts;

    return <Shell profile={profile}>
      <div className="app-head"><div><span className="pill">MASTER ADMIN</span><h1>Biznis pregled</h1><p className="muted">Obračun za {monthLabel()}. Naknada knjigovođi: 250 RSD po korisniku aplikacije.</p></div></div>
      <div className="grid master-stats">
        <Stat label="Klijenti" value={companyOrgs.length}/>
        <button className="card stat stat-button" onClick={()=>setShowAccountants((v:boolean)=>!v)}><span>Knjigovođe</span><strong>{accountants.length}</strong><small>klik za listu</small></button>
        <Stat label="Bruto MRR" value={money(gross)}/>
        <Stat label="Naknade knjigovođama" value={money(payouts)}/>
        <Stat label="Profit*" value={money(profit)}/>
      </div>
      <div className="master-note">* Profit = pretplate − naknade knjigovođama, pre ostalih troškova poslovanja. Datum mesečnog obračuna/uplate: <b>{monthDueDate()}</b>.</div>

      {showAccountants&&<section className="master-section"><div className="section-title"><div><span className="pill">KNJIGOVOĐE</span><h2>Obračun knjigovođa</h2></div><button className="btn" onClick={()=>setShowAccountants(false)}>Sakrij</button></div><div className="grid accountant-grid">
        {accountants.map((a:any)=><div className="card accountant-card" key={a.id}><div className="accountant-head"><div className="accountant-avatar"><Users size={22}/></div><div><h3>{a.name}</h3><span>{a.email||"—"}</span></div></div><div className="accountant-kpis"><div><span>Klijenti</span><b>{a.clients.length}</b></div><div><span>Korisnici app</span><b>{a.users}</b></div><div><span>Za uplatu</span><b>{money(a.payout)}</b></div></div><div className="payout-line"><span>Uplatiti najkasnije</span><b>{monthDueDate()}</b></div><details><summary>Lista klijenata ({a.clients.length})</summary><div className="accountant-clients">{a.clients.map((o:any)=><div key={o.id}><span>{o.name}</span><b>{companyUsersByOrg.get(String(o.id))||1} koris.</b></div>)}</div></details></div>)}
        {accountants.length===0&&<div className="card empty-master">Nema dodeljenih knjigovođa.</div>}
      </div></section>}

      <section className="master-section"><div className="section-title"><div><span className="pill">KLIJENTI</span><h2>Pregled firmi</h2></div></div><div className="grid client-grid">
        {companyOrgs.map((o:any)=>{const ms=master.members.filter((m:any)=>m.organization_id===o.id);const rc=master.receipts.filter((r:any)=>r.organization_id===o.id);const users=companyUsersByOrg.get(String(o.id))||1;return <div className="card client" key={o.id}><span className="badge">{String(o.plan||"basic").toUpperCase()}</span><h3>{o.name}</h3><div className="muted">PIB {o.pib||"—"}</div><div className="kpis"><span>RAČUNI<b>{rc.length}</b></span><span>KORISNICI<b>{users}</b></span><span>KNJIGOVOĐE<b>{ms.filter((m:any)=>m.role==="accountant").length}</b></span></div></div>})}
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

  function onScanDone(result:any){
    const receipt=result?.receipt;
    if(receipt){
      setReceiptList(old=>[receipt,...old.filter(r=>r.id!==receipt.id)]);
      setCategoryFilter("Sve");
      setQuery("");
      setHomeMessage(result?.duplicate?"Račun je već postojao u bazi.":`Račun je dodat u ${receipt.category||"Ostalo"}.`);
    }
    setScan(false);
    router.refresh();
  }

  async function sendNow(){
    if(!activeOrg||sendBusy) return;
    setSendBusy(true);setHomeMessage("");
    try{
      const r=await fetch("/api/receipts/send-to-accountant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({organization_id:activeOrg.organization_id})});
      const d=await r.json();
      if(!r.ok) throw new Error(d.error||"Slanje nije uspelo.");
      setReceiptList(old=>old.map(x=>x.sent_to_accountant_at?x:{...x,sent_to_accountant_at:d.sent_at}));
      setHomeMessage(d.sent?`${d.sent} račun(a) je poslato knjigovođi.`:"Nema novih računa za slanje.");
    }catch(e:any){setHomeMessage(e.message||"Slanje nije uspelo.");}
    finally{setSendBusy(false);}
  }

  async function saveSendSchedule(){
    if(!activeOrg||settingsBusy) return;
    setSettingsBusy(true);setSettingsMessage("");
    try{
      const r=await fetch("/api/org/receipt-send-settings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({organization_id:activeOrg.organization_id,schedule:sendSchedule})});
      const d=await r.json();
      if(!r.ok) throw new Error(d.error||"Podešavanje nije sačuvano.");
      setSettingsMessage("Podešavanje automatskog slanja je sačuvano.");
      router.refresh();
    }catch(e:any){setSettingsMessage(e.message||"Podešavanje nije sačuvano.");}
    finally{setSettingsBusy(false);}
  }

  async function linkAccountant(){
    if(!activeOrg||accountantLinkBusy) return;
    if(!selectedAccountantCompany){setAccountantLinkMessage("Izaberite knjigovodstvenu firmu iz APR pretrage.");return;}
    setAccountantLinkBusy(true);setAccountantLinkMessage("");
    try{
      const r=await fetch("/api/org/accountant-link",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({organization_id:activeOrg.organization_id,accountant_company_id:selectedAccountantCompany.id,accountant_email:accountantLinkEmail})});
      const d=await r.json();
      if(!r.ok) throw new Error(d.error||"Povezivanje nije uspelo.");
      setAccountantLinkMessage(d.message||"Podešavanje je sačuvano.");
      router.refresh();
    }catch(e:any){setAccountantLinkMessage(e.message||"Povezivanje nije uspelo.");}
    finally{setAccountantLinkBusy(false);}
  }

  async function reviewRelationship(kind:"access"|"accountant",id:string,decision:"approve"|"reject"){
    setHomeMessage("");
    try{
      const path=kind==="access"?`/api/company-access-requests/${id}`:`/api/accountant-company/${id}`;
      const r=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({decision})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||"Zahtev nije obrađen.");
      setHomeMessage(d.message||"Zahtev je obrađen.");router.refresh();
    }catch(e:any){setHomeMessage(e.message||"Zahtev nije obrađen.");}
  }

  async function uploadLogo(file?:File){
    if(!file||!activeOrg) return;
    if(!file.type.startsWith("image/")){setHomeMessage("Logo mora biti slika.");return;}
    setHomeMessage("Dodajem logo…");
    try{
      const tokenResponse=await fetch("/api/org/logo/upload",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({organization_id:activeOrg.organization_id,file_name:file.name,size_bytes:file.size})});
      const signed=await tokenResponse.json();
      if(!tokenResponse.ok) throw new Error(signed.error||"Upload nije pokrenut.");
      const browser=createBrowserSupabase();
      const {error:uploadError}=await browser.storage.from("organization-assets").uploadToSignedUrl(signed.path,signed.token,file,{contentType:file.type,upsert:false});
      if(uploadError) throw new Error(uploadError.message);
      const register=await fetch("/api/org/logo/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({organization_id:activeOrg.organization_id,path:signed.path})});
      const registered=await register.json();
      if(!register.ok) throw new Error(registered.error||"Logo nije sačuvan.");
      setLogoAvailable(true);setLogoVersion(Date.now());setHomeMessage("Logo firme je sačuvan.");
    }catch(e:any){setHomeMessage(e.message||"Logo nije dodat.");}
    finally{if(logoInputRef.current)logoInputRef.current.value="";}
  }

  return <Shell profile={profile} activeOrg={activeOrg} hasBottomNav={isCompanyUser} logoAvailable={logoAvailable} logoVersion={logoVersion}>
    <div className={`app-head company-home-head ${isCompanyUser?"company-user-dashboard-head":""}`} id="home">
      {!isCompanyUser&&<div className="company-identity">
        {activeOrg&&<div className="company-logo-wrap">
          {logoAvailable?<img className="company-logo-image" src={`/api/org/logo?organization_id=${activeOrg.organization_id}&v=${logoVersion}`} alt={`Logo ${activeOrg.name}`}/>:<div className="company-logo-placeholder">{String(activeOrg.name||"F").slice(0,1).toUpperCase()}</div>}
        </div>}
        <div><span className="pill">{role}</span><h1 className="company-name-heading">{activeOrg?.name||"FiscalBox"}</h1><p className="muted">{activeOrg?.pib?`PIB ${activeOrg.pib}`:"Izaberite ili kreirajte firmu."}</p></div>
      </div>}
      {isCompanyUser&&activeOrg&&<div className="mobile-dashboard-icons" aria-label="Pregled poslovanja">
        <DashboardIcon icon={<ReceiptText size={23}/>} label="Računi" value={String(receiptList.length)}/>
        <DashboardIcon icon={<WalletCards size={23}/>} label="Troškovi" value={money(total)}/>
        <DashboardIcon icon={<BadgePercent size={23}/>} label="PDV" value={money(tax)}/>
        <DashboardIcon icon={<Clock3 size={23}/>} label="Čeka slanje" value={String(unsentCount)} alert={unsentCount>0}/>
      </div>}
      <div className="actions company-home-actions">
        {organizations.length>1&&<select className="select" value={activeOrg?.organization_id||""} onChange={e=>router.push("/app?org="+e.target.value)}>{organizations.map((o:any)=><option value={o.organization_id} key={o.organization_id}>{o.name}</option>)}</select>}
        {activeOrg&&activeOrg.role==="accountant"&&<button className="btn" onClick={openFiles}><FileText size={17}/> Dokumenti klijenta</button>}
        {isCompanyUser&&<button className="btn btn-primary send-accountant-btn" onClick={sendNow} disabled={sendBusy}><Send size={17}/>{sendBusy?"Šaljem…":`Pošalji knjigovođi${unsentCount?` (${unsentCount})`:""}`}</button>}
        {isCompanyUser&&<button className="btn btn-accent desktop-scan-btn" onClick={openScanner}>Skeniraj QR</button>}
      </div>
    </div>

    {!activeOrg?(accessContext?.ownPending?.length?<PendingCompanyAccess requests={accessContext.ownPending}/>:<Onboarding/>):<>
      {homeMessage&&<div className="home-message">{homeMessage}</div>}
      {(accessContext?.incomingAccessRequests?.length||accessContext?.incomingAccountantRequests?.length)?<div className="card company-requests-card"><div className="section-title"><div><span className="pill">ZAHTEVI</span><h3>Pristup i povezivanje firme</h3></div></div><div className="company-request-list">{(accessContext?.incomingAccessRequests||[]).map((r:any)=><div key={r.id} className="company-request-row"><div><b>{r.requester?.full_name||r.requester?.username||r.requester?.auth_email||'Novi korisnik'}</b><span>Traži pristup postojećem FiscalBox nalogu firme.</span></div><div className="actions"><button className="btn btn-primary" onClick={()=>reviewRelationship('access',r.id,'approve')}>Odobri</button><button className="btn" onClick={()=>reviewRelationship('access',r.id,'reject')}>Odbij</button></div></div>)}{(accessContext?.incomingAccountantRequests||[]).map((r:any)=><div key={r.id} className="company-request-row"><div><b>{r.accounting_organization?.name||'Knjigovodstvena agencija'}</b><span>Traži povezivanje sa vašom firmom{r.accounting_organization?.pib?` · PIB ${r.accounting_organization.pib}`:''}.</span></div><div className="actions"><button className="btn btn-primary" onClick={()=>reviewRelationship('accountant',r.id,'approve')}>Poveži</button><button className="btn" onClick={()=>reviewRelationship('accountant',r.id,'reject')}>Odbij</button></div></div>)}</div></div>:null}
      {searchOpen&&<div className="card user-search-card"><div className="user-search-row"><span aria-hidden="true">⌕</span><input ref={searchRef} className="user-search-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Pretraži dobavljača, PIB, broj računa, kategoriju…"/>{query&&<button className="user-search-clear" onClick={()=>setQuery("")} aria-label="Obriši pretragu">×</button>}</div><div className="muted" style={{fontSize:12,marginTop:8}}>{query?`${filteredReceipts.length} rezultata`:"Pretražite kompletnu bazu računa."}</div></div>}
      {!isCompanyUser&&<div className="grid stats"><Stat label="Broj računa" value={receiptList.length}/><Stat label="Ukupni troškovi" value={money(total)}/><Stat label="PDV" value={money(tax)}/><Stat label="Primljeno" value={receiptList.length}/></div>}

      <div className="card expense-overview">
        <div className="expense-overview-head"><div><span className="pill"><Sparkles size={13}/> AUTOMATSKA KATEGORIZACIJA</span><h3>Pregled po vrsti troška</h3></div><label className="category-filter"><span>Kategorija</span><select className="select" value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}><option value="Sve">Sve kategorije</option>{RECEIPT_CATEGORIES.map((c:string)=><option key={c} value={c}>{c}</option>)}</select></label></div>
        <div className="expense-category-grid">{categoryTotals.slice(0,8).map(c=><button key={c.category} type="button" className={`expense-category ${categoryFilter===c.category?"active":""}`} onClick={()=>setCategoryFilter(categoryFilter===c.category?"Sve":c.category)}><span>{c.category}</span><b>{money(c.total)}</b><small>{c.count} račun(a)</small></button>)}{categoryTotals.length===0&&<div className="muted">Kategorije će se pojaviti nakon prvog skeniranog računa.</div>}</div>
      </div>

      <div className="card table-card" id="baza"><div className="table-tools"><div><b>Baza fiskalnih računa</b><div className="muted" style={{fontSize:12}}>{query||categoryFilter!=="Sve"?`${filteredReceipts.length} pronađeno`:`Poslednjih ${receiptList.length} računa`}</div></div><div className="actions">{isCompanyUser&&<button className="btn" onClick={openFiles}>Fajlovi</button>}<a className="btn" href={`/api/export/csv?organization_id=${activeOrg.organization_id}`}>CSV</a></div></div><div className="table-wrap"><table><thead><tr><th>Datum</th><th>Dobavljač</th><th>PIB</th><th>Kategorija</th><th>PDV</th><th>Iznos</th>{isCompanyUser&&<th>Knjigovođa</th>}<th>Status</th><th></th></tr></thead><tbody>{filteredReceipts.map((r:any)=><tr key={r.id}><td>{dt(r.sdc_time||r.created_at)}</td><td><b>{r.merchant_name||"—"}</b><div className="muted mono" style={{fontSize:10}}>{r.invoice_number||""}</div></td><td>{r.merchant_pib||"—"}</td><td><span>{r.category||"Ostalo"}</span>{r.category_source==="smart_classifier"&&<small className="auto-category"><Sparkles size={10}/> AUTO</small>}</td><td>{money(r.total_tax)}</td><td><b>{money(r.total_amount)}</b></td>{isCompanyUser&&<td><span className={`badge ${r.sent_to_accountant_at?"":"warn"}`}>{r.sent_to_accountant_at?"POSLATO":"ČEKA"}</span></td>}<td><span className={`badge ${r.verification_status==="provereno"?"":"warn"}`}>{r.verification_status}</span></td><td><a className="btn" target="_blank" href={`/app/receipts/${r.id}/print`}>Štampa/PDF</a></td></tr>)}{filteredReceipts.length===0&&<tr><td colSpan={isCompanyUser?9:8}><div className="empty-state">Nema računa koji odgovaraju filteru.</div></td></tr>}</tbody></table></div></div>
    </>}

    {scan&&activeOrg&&<div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setScan(false)}}><div className="modal qr-modal"><div className="modal-head"><div><span className="pill">NOVI RAČUN</span><h2>QR skener</h2></div><button className="btn" onClick={()=>setScan(false)}>Zatvori</button></div><p className="muted" style={{marginTop:0}}>Posle očitavanja račun se odmah dodaje na listu i automatski kategorizuje.</p><QrScanner organizationId={activeOrg.organization_id} onDone={onScanDone}/></div></div>}
    {moreOpen&&isCompanyUser&&<div className="bottom-sheet-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setMoreOpen(false)}}><div className="bottom-sheet"><div className="bottom-sheet-handle"/><div className="bottom-sheet-head"><div><span className="pill">VIŠE</span><h3>Opcije naloga</h3></div><button className="btn" onClick={()=>setMoreOpen(false)}>Zatvori</button></div><div className="more-list"><div className="more-info"><span>Firma</span><b>{activeOrg.name}</b></div><div className="more-info"><span>Paket</span><b>{String(activeOrg.plan||"basic").toUpperCase()}</b></div><div className="auto-send-settings"><b>Poveži knjigovođu</b><p>Unesite PIB knjigovodstvene firme. Ako PIB nije poznat ili servis nije dostupan, koristite rezervnu pretragu po nazivu ili matičnom broju. Ako firma još nema FiscalBox nalog, možete dodati email za poziv.</p><CompanyLookup value={selectedAccountantCompany} onSelect={setSelectedAccountantCompany} label="PIB knjigovodstvene firme" compact showDetails={false}/><input className="input" type="email" value={accountantLinkEmail} onChange={e=>setAccountantLinkEmail(e.target.value)} placeholder="Email knjigovođe (ako još nije registrovan)"/><button className="btn" onClick={linkAccountant} disabled={accountantLinkBusy||!selectedAccountantCompany}>{accountantLinkBusy?"Proveravam…":"Poveži / pošalji poziv"}</button>{accountantLinkMessage&&<small>{accountantLinkMessage}</small>}</div><div className="auto-send-settings"><b>Automatsko slanje knjigovođi</b><p>Izaberite kada da se svi neposlati fiskalni računi automatski proslede knjigovođi.</p><select className="select" value={sendSchedule} onChange={e=>setSendSchedule(e.target.value)}><option value="manual">Isključeno — šaljem ručno</option><option value="weekly">Nedeljno — svakog petka</option><option value="monthly">Mesečno — poslednjeg dana</option></select><button className="btn btn-primary" onClick={saveSendSchedule} disabled={settingsBusy}>{settingsBusy?"Čuvam…":"Sačuvaj raspored"}</button>{settingsMessage&&<small>{settingsMessage}</small>}</div><button className="more-action" onClick={sendNow}>Pošalji račune knjigovođi sada <b>→</b></button><button className="more-action" onClick={openFiles}>Fajlovi <b>→</b></button><a className="more-action" href={`/app/subscription?organization_id=${activeOrg.organization_id}`}>Pretplata <b>→</b></a><a className="more-action" href="/app/billing">Moji računi <b>→</b></a><a className="more-action" href={`/api/export/csv?organization_id=${activeOrg.organization_id}`}>Izvezi bazu kao CSV <b>→</b></a><a className="more-action" href="/app/setup">Podešavanja firme <b>→</b></a><form method="post" action="/api/auth/logout"><button className="more-action danger" style={{width:"100%"}}>Odjavi se <b>→</b></button></form></div></div></div>}
    {isCompanyUser&&<UserBottomNav active={navActive} onHome={goHome} onSearch={openSearch} onScan={openScanner} onFiles={openFiles} onMore={openMore}/>} 
  </Shell>;
}

function Shell({profile,activeOrg,children,hasBottomNav=false,logoAvailable=false,logoVersion=0}:any){return <div className={`app-shell ${hasBottomNav?"with-bottom-nav":""}`}><header className="appbar"><div className="container appbar-in"><a className="brand" href="/app"><span className="logo">F</span><BrandWordmark/></a><div className="appbar-account-actions"><div className="appbar-push"><PushNotificationOptIn/></div><CompanyHeaderMenu profile={profile} organization={activeOrg} logoAvailable={logoAvailable} logoVersion={logoVersion}/></div></div></header><main className="container app-main">{children}</main></div>}
function ServiceBlocked({profile,reason}:any){return <div className="app-shell"><header className="appbar"><div className="container appbar-in"><a className="brand" href="/"><span className="logo">F</span><BrandWordmark/></a><form method="post" action="/api/auth/logout"><button className="btn">Odjava</button></form></div></header><main className="container app-main"><div className="card service-blocked"><span className="pill">USLUGA BLOKIRANA</span><h1>FiscalBox pristup je privremeno blokiran</h1><p>{reason||"Obratite se FiscalBox administratoru radi ponovne aktivacije usluge."}</p><small>Nalog: {profile.username}</small></div></main></div>}

function PendingCompanyAccess({requests}:any){return <div className="card pending-company-access"><span className="pill">ZAHTEV POSLAT</span><h2>Firma već ima aktivan FiscalBox nalog</h2><p className="muted">Nećemo praviti duplikat firme niti vam automatski dati administratorska prava. Postojeći administrator mora da odobri vaš zahtev za pristup.</p>{(requests||[]).map((r:any)=><div key={r.id} className="pending-company-access-row"><b>{r.organizations?.name||'Firma'}</b><span>{r.organizations?.pib?`PIB ${r.organizations.pib} · `:''}zahtev na čekanju</span></div>)}</div>}

function DashboardIcon({icon,label,value,alert=false}:any){return <div className={`dashboard-icon-card ${alert?"alert":""}`}><div className="dashboard-icon-symbol">{icon}</div><div className="dashboard-icon-copy"><span>{label}</span><strong>{value}</strong></div></div>}
function Stat({label,value}:any){return <div className="card stat"><span>{label}</span><strong>{value}</strong></div>}
function Onboarding(){return <div className="card" style={{padding:30,maxWidth:650}}><span className="pill">PRVI KORAK</span><h2>Povežite firmu</h2><p className="muted">Unesite PIB ili matični broj. Kada je APR API konfigurisan, podaci firme se popunjavaju automatski.</p><a className="btn btn-primary" href="/app/setup">Unesi PIB / matični broj</a></div>}
