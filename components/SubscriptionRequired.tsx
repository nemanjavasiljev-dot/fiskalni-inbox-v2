'use client';

import { useState } from 'react';
import BrandWordmark from '@/components/BrandWordmark';
import { CreditCard, LogOut, ShieldCheck } from 'lucide-react';

function dateLabel(v?:string|null){return v?new Intl.DateTimeFormat('sr-RS',{dateStyle:'long'}).format(new Date(v)):'—';}

export default function SubscriptionRequired({organization,subscription,profile}:{organization:any;subscription:any;profile:any}){
  const [busy,setBusy]=useState('');const [error,setError]=useState('');
  async function checkout(plan:'basic'|'premium'){
    setBusy(plan);setError('');
    try{
      const r=await fetch('/api/subscriptions/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organization_id:organization.id||organization.organization_id,plan})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||'Pretplata nije mogla da se pokrene.');
      window.location.href=d.url;
    }catch(e:any){setError(e.message||'Pretplata nije mogla da se pokrene.');setBusy('');}
  }
  const status=String(subscription?.status||'nije aktivna');
  const trialExpired=status==='trial' && subscription?.trial_ends_at && new Date(subscription.trial_ends_at).getTime()<=Date.now();
  return <div className="subscription-lock-shell">
    <header className="appbar"><div className="container appbar-in"><a className="brand" href="/"><span className="logo">F</span><BrandWordmark/></a><form method="post" action="/api/auth/logout"><button className="btn"><LogOut size={15}/> Odjava</button></form></div></header>
    <main className="container subscription-lock-main"><div className="card subscription-lock-card">
      <span className="subscription-lock-icon"><CreditCard size={30}/></span>
      <span className="pill">PRETPLATA</span>
      <h1>{trialExpired?'Probni period je istekao':'Aktivirajte FiscalBox pretplatu'}</h1>
      <p className="muted">Nalog <b>{organization.name}</b> je sačuvan, ali poslovne funkcije zahtevaju aktivnu pretplatu. Vaši podaci ostaju u bazi i postaju dostupni odmah nakon aktivacije.</p>
      {subscription?.trial_ends_at&&<div className="subscription-detail"><span>Probni period</span><b>do {dateLabel(subscription.trial_ends_at)}</b></div>}
      <div className="subscription-detail"><span>Status</span><b>{status.toUpperCase()}</b></div>
      <div className="subscription-plan-grid">
        <div className="subscription-plan-card"><span>BASIC</span><strong>1.250 RSD + PDV</strong><small>po aktivnom korisniku / mesečno</small><button className="btn btn-primary" disabled={!!busy} onClick={()=>checkout('basic')}>{busy==='basic'?'Otvaram plaćanje…':'Aktiviraj Basic'}</button></div>
        <div className="subscription-plan-card premium"><span>PREMIUM</span><strong>1.790 RSD + PDV</strong><small>po aktivnom korisniku / mesečno</small><button className="btn btn-brand-green" disabled={!!busy} onClick={()=>checkout('premium')}>{busy==='premium'?'Otvaram plaćanje…':'Aktiviraj Premium'}</button></div>
      </div>
      {error&&<div className="error">{error}</div>}
      <p className="subscription-secure"><ShieldCheck size={15}/> Plaćanje se obavlja na sigurnoj stranici payment providera. Aktivacija se potvrđuje automatski webhook-om.</p>
      <small className="muted">Prijavljeni korisnik: {profile?.username}</small>
    </div></main>
  </div>;
}
