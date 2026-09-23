'use client';
import { useState } from 'react';
import BrandWordmark from '@/components/BrandWordmark';
import { Landmark, LogOut, ShieldCheck } from 'lucide-react';

function dateLabel(v?:string|null){return v?new Intl.DateTimeFormat('sr-RS',{dateStyle:'long'}).format(new Date(v)):'—';}
export default function SubscriptionRequired({organization,subscription,profile}:{organization:any;subscription:any;profile:any}){
  const [busy,setBusy]=useState('');const [error,setError]=useState('');
  async function choose(plan:'basic'|'premium'){
    setBusy(plan);setError('');try{const r=await fetch('/api/subscriptions/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organization_id:organization.id||organization.organization_id,plan})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Predračun nije mogao da se kreira.');window.location.href=d.url||'/app/billing?status=unpaid';}catch(e:any){setError(e.message||'Predračun nije mogao da se kreira.');setBusy('');}
  }
  const status=String(subscription?.status||'nije aktivna');const trialExpired=status==='trial'&&subscription?.trial_ends_at&&new Date(subscription.trial_ends_at).getTime()<=Date.now();
  return <div className="subscription-lock-shell"><header className="appbar"><div className="container appbar-in"><a className="brand" href="/"><span className="logo">F</span><BrandWordmark/></a><form method="post" action="/api/auth/logout"><button className="btn"><LogOut size={15}/> Odjava</button></form></div></header><main className="container subscription-lock-main"><div className="card subscription-lock-card">
    <span className="subscription-lock-icon"><Landmark size={30}/></span><span className="pill">PRETPLATA</span><h1>{trialExpired?'Probni period je istekao':'Aktivirajte FiscalBox pretplatu'}</h1><p className="muted">Izaberite paket. FiscalBox automatski šalje predračun na email i dodaje ga u Moji računi → Neplaćeno.</p>
    {subscription?.trial_ends_at&&<div className="subscription-detail"><span>Probni period</span><b>do {dateLabel(subscription.trial_ends_at)}</b></div>}<div className="subscription-detail"><span>Status</span><b>{status.toUpperCase()}</b></div>
    <div className="subscription-plan-grid"><div className="subscription-plan-card"><span>BASIC</span><strong>1.250 RSD</strong><small>po korisniku / mesečno · bez PDV-a</small><button className="btn btn-primary" disabled={!!busy} onClick={()=>choose('basic')}>{busy==='basic'?'Kreiram predračun…':'Izaberi Basic'}</button></div><div className="subscription-plan-card premium"><span>PREMIUM</span><strong>2.000 RSD</strong><small>po korisniku / mesečno · bez PDV-a</small><button className="btn btn-brand-green" disabled={!!busy} onClick={()=>choose('premium')}>{busy==='premium'?'Kreiram predračun…':'Izaberi Premium'}</button></div></div>
    {error&&<div className="error">{error}</div>}<p className="subscription-secure"><ShieldCheck size={15}/> Predračun sadrži NBS IPS QR. Pretplata se aktivira nakon verifikovane uplate, kada se automatski izdaje finalni račun.</p><small className="muted">Prijavljeni korisnik: {profile?.username}</small>
  </div></main></div>;
}
