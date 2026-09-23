"use client";
import React from 'react';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ActivateClient({token}:{token:string}){
  const router=useRouter();
  const [data,setData]=React.useState<any>(null);
  const [error,setError]=React.useState('');
  const [password,setPassword]=React.useState('');
  const [confirm,setConfirm]=React.useState('');
  const [busy,setBusy]=React.useState(false);
  const [plan,setPlan]=React.useState<'basic'|'premium'>('basic');
  const [done,setDone]=React.useState<any>(null);
  React.useEffect(()=>{(async()=>{
    if(!token){setError('Poziv nije ispravan.');return;}
    const r=await fetch(`/api/client-invite/lookup?token=${encodeURIComponent(token)}`);const d=await r.json();
    if(!r.ok)setError(d.error||'Poziv nije dostupan.');else setData(d);
  })()},[token]);
  async function activate(e:React.FormEvent){
    e.preventDefault();setError('');
    if(password!==confirm){setError('Lozinke se ne poklapaju.');return;}
    setBusy(true);
    const r=await fetch('/api/client-invite/accept',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,password,plan})});
    const d=await r.json();setBusy(false);
    if(!r.ok){setError(d.error||'Aktivacija nije uspela.');return;}
    setDone(d);setTimeout(()=>router.push(d.redirect||'/app'),1500);
  }
  if(error&&!data)return <div className="invite-activate"><div className="error">{error}</div><a className="btn" href="/login">Idi na prijavu</a></div>;
  if(!data)return <div className="invite-activate"><p className="muted">Proveravam poziv…</p></div>;
  if(done)return <div className="invite-activate"><CheckCircle2 size={42}/><h1>Nalog je aktiviran</h1><p>Vaše korisničko ime je <b className="mono">{done.username}</b>.</p><p className="muted">Prijavljujemo vas u aplikaciju…</p></div>;
  return <div className="invite-activate"><span className="pill">POZIV KLIJENTA</span><h1>Aktivirajte FiscalBox</h1><p className="muted"><b>{data.accounting_office}</b> je pripremio nalog za firmu <b>{data.company_name}</b>, PIB {data.pib}. Postavite lozinku i izaberite probni paket.</p><form onSubmit={activate}><div className="field"><label>Email</label><input className="input" value={data.email||''} disabled/></div><div className="field"><label>Probni paket — 10 dana besplatno</label><div className="register-plans register-plans-production invite-trial-plans"><button type="button" className={`register-plan ${plan==='basic'?'selected':''}`} onClick={()=>setPlan('basic')}><b>Basic</b><strong>1.250 RSD + PDV</strong><small>posle trial-a / korisnik mesečno</small></button><button type="button" className={`register-plan ${plan==='premium'?'selected':''}`} onClick={()=>setPlan('premium')}><b>Premium</b><strong>1.790 RSD + PDV</strong><small>posle trial-a / korisnik mesečno</small></button></div></div><div className="field"><label>Nova lozinka</label><input className="input" type="password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Najmanje 8 znakova"/></div><div className="field"><label>Ponovite lozinku</label><input className="input" type="password" minLength={8} required value={confirm} onChange={e=>setConfirm(e.target.value)}/></div>{error&&<div className="error">{error}</div>}<button className="btn btn-primary" style={{width:'100%',marginTop:16}} disabled={busy}><KeyRound size={17}/>{busy?'Aktiviram…':`Aktiviraj ${plan==='premium'?'Premium':'Basic'} trial`}</button></form><div className="demo-box">Probni period traje tačno 10 dana i ne traži karticu. Sve funkcije iz izabranog paketa su aktivne tokom trial-a. Firma se automatski povezuje sa knjigovođom koji vas je pozvao.</div></div>;
}
