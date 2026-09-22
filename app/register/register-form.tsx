'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Calculator, Check, Search, UserRound } from 'lucide-react';

type Role='company'|'accountant';
type Company={name:string;pib:string;registration_number:string;legal_form:string;address:string;municipality:string;activity_code:string;activity_name:string;apr_raw:any};
const emptyCompany:Company={name:'',pib:'',registration_number:'',legal_form:'',address:'',municipality:'',activity_code:'',activity_name:'',apr_raw:null};

export default function RegisterForm({initialPlan='trial'}:{initialPlan?:string}){
  const router=useRouter();
  const [step,setStep]=useState(1);
  const [role,setRole]=useState<Role>('company');
  const [username,setUsername]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [fullName,setFullName]=useState('');
  const [lookup,setLookup]=useState('');
  const [company,setCompany]=useState<Company>(emptyCompany);
  const [manual,setManual]=useState(false);
  const [lookupBusy,setLookupBusy]=useState(false);
  const [lookupMessage,setLookupMessage]=useState('');
  const [plan,setPlan]=useState<'trial'|'basic'|'premium'>(initialPlan==='premium'?'premium':initialPlan==='basic'?'basic':'trial');
  const [accountantPib,setAccountantPib]=useState('');
  const [accountantEmail,setAccountantEmail]=useState('');
  const [accountantState,setAccountantState]=useState<any>(null);
  const [checkingAccountant,setCheckingAccountant]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  function next(){setError('');setStep(s=>Math.min(5,s+1));}
  function back(){setError('');setStep(s=>Math.max(1,s-1));}
  function field(k:keyof Company,v:string){setCompany(c=>({...c,[k]:v}));}

  function validateAccount(){
    if(!/^[a-z0-9._-]{3,30}$/.test(username.trim().toLowerCase())) return setError('Korisničko ime mora imati 3–30 znakova.'),false;
    if(!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Unesite ispravnu email adresu.'),false;
    if(password.length<8) return setError('Lozinka mora imati najmanje 8 znakova.'),false;
    setError('');return true;
  }
  function validateCompany(){
    if(!company.name.trim()) return setError('Naziv firme je obavezan.'),false;
    if(!company.pib && !company.registration_number) return setError('Unesite PIB ili matični broj.'),false;
    setError('');return true;
  }

  async function findCompany(){
    setLookupBusy(true);setLookupMessage('');setError('');
    try{
      const r=await fetch('/api/register/apr-lookup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:lookup})});
      const d=await r.json();
      if(!r.ok) throw new Error(d.error||'APR pretraga nije uspela.');
      setCompany({...emptyCompany,...d.company});setManual(true);setLookupMessage('Podaci su pronađeni u APR-u. Proverite ih pre nastavka.');
    }catch(e:any){setLookupMessage(e.message||'APR pretraga nije uspela. Podatke možete uneti ručno.');setManual(true);}
    finally{setLookupBusy(false);}
  }

  async function checkAccountant(){
    if(accountantPib.length!==9){setAccountantState({found:false,message:'Unesite PIB knjigovođe od 9 cifara.'});return;}
    setCheckingAccountant(true);setAccountantState(null);
    try{
      const r=await fetch('/api/register/check-accountant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pib:accountantPib})});
      const d=await r.json();
      if(!r.ok) throw new Error(d.error||'Provera nije uspela.');
      setAccountantState(d.found?{...d,message:`Knjigovođa je registrovan: ${d.organization_name}. Firma će se automatski povezati.`}:{found:false,message:'Knjigovođa još nije registrovan. Unesite njegov email za poziv i buduće slanje.'});
    }catch(e:any){setAccountantState({found:false,message:e.message||'Provera nije uspela.'});}
    finally{setCheckingAccountant(false);}
  }

  async function submit(){
    setBusy(true);setError('');
    try{
      const r=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role,username:username.trim().toLowerCase(),email:email.trim().toLowerCase(),password,full_name:fullName,company,plan,accountant_pib:role==='company'?accountantPib:'',accountant_email:role==='company'?accountantEmail:''})});
      const d=await r.json();
      if(!r.ok) throw new Error(d.error||'Registracija nije uspela.');
      router.push(d.redirect||'/app');router.refresh();
    }catch(e:any){setError(e.message||'Registracija nije uspela.');}
    finally{setBusy(false);}
  }

  return <div className="register-flow">
    <div className="register-progress">{[1,2,3,4,5].map(n=><span key={n} className={n<=step?'active':''}>{n}</span>)}</div>

    {step===1&&<section className="register-step">
      <h2>Ko otvara nalog?</h2><p className="muted">Izaberite tip naloga. Ovo određuje početni dashboard i povezivanje klijenata.</p>
      <div className="role-choice">
        <button className={`role-choice-card ${role==='company'?'selected':''}`} onClick={()=>setRole('company')}><Building2/><b>FIRMA</b><span>Skeniranje računa, fajlovi i slanje knjigovođi.</span>{role==='company'&&<Check className="choice-check"/>}</button>
        <button className={`role-choice-card ${role==='accountant'?'selected':''}`} onClick={()=>setRole('accountant')}><Calculator/><b>KNJIGOVOĐA</b><span>Klijenti, primljeni računi, dokumenti i PDV pregled.</span>{role==='accountant'&&<Check className="choice-check"/>}</button>
      </div>
      <button className="btn btn-primary register-next" onClick={next}>Nastavi</button>
    </section>}

    {step===2&&<section className="register-step">
      <h2>Podaci za prijavu</h2><div className="setup-grid">
        <div className="field"><label>Ime i prezime</label><input className="input" value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Ime i prezime"/></div>
        <div className="field"><label>Korisničko ime</label><input className="input" value={username} onChange={e=>setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g,''))} placeholder="npr. nemanja"/></div>
        <div className="field setup-wide"><label>Email</label><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="ime@firma.rs"/></div>
        <div className="field setup-wide"><label>Lozinka</label><input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Najmanje 8 znakova"/></div>
      </div>{error&&<div className="error">{error}</div>}
      <div className="register-actions"><button className="btn" onClick={back}>Nazad</button><button className="btn btn-primary" onClick={()=>validateAccount()&&next()}>Nastavi</button></div>
    </section>}

    {step===3&&<section className="register-step">
      <h2>{role==='accountant'?'Podaci knjigovodstvene firme':'Podaci firme'}</h2><p className="muted">Unesite PIB ili matični broj. Ako je APR API aktiviran, podaci će se automatski popuniti.</p>
      <div className="field"><label>PIB ili matični broj</label><div className="lookup-row"><input className="input" inputMode="numeric" value={lookup} onChange={e=>setLookup(e.target.value.replace(/\D/g,''))} maxLength={9} placeholder="PIB 9 cifara ili MB 8 cifara"/><button className="btn btn-primary" onClick={findCompany} disabled={lookupBusy||![8,9].includes(lookup.length)}><Search size={16}/>{lookupBusy?'Tražim…':'Povuci podatke'}</button></div></div>
      {lookupMessage&&<div className="lookup-message">{lookupMessage}</div>}
      {!manual&&<button className="manual-link" onClick={()=>{setManual(true); if(lookup.length===9)setCompany(c=>({...c,pib:lookup})); if(lookup.length===8)setCompany(c=>({...c,registration_number:lookup}));}}>Unesi podatke ručno</button>}
      {manual&&<div className="setup-grid register-company-fields">
        <div className="field setup-wide"><label>Naziv</label><input className="input" value={company.name} onChange={e=>field('name',e.target.value)}/></div>
        <div className="field"><label>PIB</label><input className="input" value={company.pib} onChange={e=>field('pib',e.target.value.replace(/\D/g,''))} maxLength={9}/></div>
        <div className="field"><label>Matični broj</label><input className="input" value={company.registration_number} onChange={e=>field('registration_number',e.target.value.replace(/\D/g,''))} maxLength={8}/></div>
        <div className="field"><label>Pravna forma</label><input className="input" value={company.legal_form} onChange={e=>field('legal_form',e.target.value)}/></div>
        <div className="field"><label>Opština</label><input className="input" value={company.municipality} onChange={e=>field('municipality',e.target.value)}/></div>
        <div className="field setup-wide"><label>Adresa</label><input className="input" value={company.address} onChange={e=>field('address',e.target.value)}/></div>
      </div>}
      {error&&<div className="error">{error}</div>}
      <div className="register-actions"><button className="btn" onClick={back}>Nazad</button><button className="btn btn-primary" disabled={!manual} onClick={()=>validateCompany()&&next()}>Nastavi</button></div>
    </section>}

    {step===4&&<section className="register-step">
      <h2>Izaberite paket</h2><div className="register-plans">
        <button className={`register-plan ${plan==='trial'?'selected':''}`} onClick={()=>setPlan('trial')}><span className="tag-inline">10 DANA</span><b>Probni</b><strong>0 RSD</strong><small>Besplatno 10 dana. Bez obaveze.</small></button>
        <button className={`register-plan ${plan==='basic'?'selected':''}`} onClick={()=>setPlan('basic')}><b>Basic</b><strong>1.250 RSD + PDV</strong><small>po korisniku / mesečno</small></button>
        <button className={`register-plan ${plan==='premium'?'selected':''}`} onClick={()=>setPlan('premium')}><b>Premium</b><strong>1.790 RSD + PDV</strong><small>po korisniku / mesečno</small></button>
      </div><p className="muted" style={{fontSize:12,marginTop:12}}>Za Basic i Premium po završetku registracije kreira se predračun i šalje na email kada je email servis aktivan.</p>
      <div className="register-actions"><button className="btn" onClick={back}>Nazad</button><button className="btn btn-primary" onClick={()=>role==='company'?next():submit()} disabled={busy}>{role==='company'?'Nastavi':busy?'Kreiram nalog…':'Završi registraciju'}</button></div>
    </section>}

    {step===5&&role==='company'&&<section className="register-step">
      <h2>Povežite knjigovođu <span className="optional-label">opciono</span></h2><p className="muted">Unesite PIB knjigovođe. Ako je već na FiscalBox-u, povezujemo vas automatski. Ovaj korak možete uraditi i kasnije.</p>
      <div className="field"><label>PIB knjigovođe</label><div className="lookup-row"><input className="input" inputMode="numeric" value={accountantPib} onChange={e=>{setAccountantPib(e.target.value.replace(/\D/g,'').slice(0,9));setAccountantState(null)}} placeholder="9 cifara"/><button className="btn" onClick={checkAccountant} disabled={checkingAccountant||accountantPib.length!==9}>{checkingAccountant?'Proveravam…':'Proveri'}</button></div></div>
      {accountantState&&<div className={`accountant-result ${accountantState.found?'found':'not-found'}`}>{accountantState.found?<Check size={18}/>:<UserRound size={18}/>}<span>{accountantState.message}</span></div>}
      {accountantState&&!accountantState.found&&<div className="field"><label>Email knjigovođe</label><input className="input" type="email" value={accountantEmail} onChange={e=>setAccountantEmail(e.target.value)} placeholder="knjigovodja@firma.rs"/><small className="muted">Email čuvamo kao kontakt za poziv i slanje dok se knjigovođa ne registruje.</small></div>}
      {error&&<div className="error">{error}</div>}
      <div className="register-actions"><button className="btn" onClick={back}>Nazad</button><button className="btn" onClick={()=>{setAccountantPib('');setAccountantEmail('');submit()}} disabled={busy}>Preskoči za sada</button><button className="btn btn-primary" onClick={submit} disabled={busy}>{busy?'Kreiram nalog…':'Završi registraciju'}</button></div>
    </section>}
  </div>;
}
