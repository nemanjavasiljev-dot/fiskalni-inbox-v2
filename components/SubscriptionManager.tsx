'use client';
import { useState } from 'react';
import { CreditCard, ExternalLink } from 'lucide-react';

function date(v?:string|null){return v?new Intl.DateTimeFormat('sr-RS',{dateStyle:'long'}).format(new Date(v)):'—';}

export default function SubscriptionManager({organization,subscription,canManage=true}:{organization:any;subscription:any;canManage?:boolean}){
  const [busy,setBusy]=useState('');const [error,setError]=useState('');
  const status=String(subscription?.status||'pending_checkout');
  const trialActive=status==='trial'&&subscription?.trial_ends_at&&new Date(subscription.trial_ends_at).getTime()>Date.now();
  const cancelledStillActive=status==='cancelled'&&new Date(subscription?.ends_at||subscription?.current_period_end||0).getTime()>Date.now();
  const providerActive=Boolean(subscription?.provider_subscription_id)&&(['active','paused','past_due'].includes(status)||cancelledStillActive);
  async function checkout(plan:'basic'|'premium'){
    setBusy(plan);setError('');
    try{const r=await fetch('/api/subscriptions/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organization_id:organization.id||organization.organization_id,plan})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Checkout nije dostupan.');window.location.href=d.url;}catch(e:any){setError(e.message||'Checkout nije dostupan.');setBusy('');}
  }
  return <div className="subscription-manager">
    <div className="grid subscription-kpis">
      <div className="card stat"><span>Paket</span><strong>{String(subscription?.plan||organization.plan||'basic').toUpperCase()}</strong></div>
      <div className="card stat"><span>Status</span><strong>{status.toUpperCase()}</strong></div>
      <div className="card stat"><span>Korisnici</span><strong>{subscription?.seat_count||1}</strong></div>
      <div className="card stat"><span>{trialActive?'Trial do':'Sledeća obnova'}</span><strong className="subscription-date-value">{date(trialActive?subscription?.trial_ends_at:subscription?.renews_at||subscription?.current_period_end)}</strong></div>
    </div>
    {providerActive&&canManage?<div className="card subscription-live-card"><div><span className="pill">AKTIVNA PRETPLATA</span><h2>Upravljajte plaćanjem i paketom</h2><p className="muted">Payment metod, otkazivanje i podaci za naplatu otvaraju se u sigurnom korisničkom portalu.</p></div><a className="btn btn-primary" href={`/api/subscriptions/portal?organization_id=${encodeURIComponent(organization.id||organization.organization_id)}`}><ExternalLink size={16}/> Upravljaj pretplatom</a></div>:null}
    {trialActive&&<div className="card subscription-live-card"><div><span className="pill">10 DANA BESPLATNO</span><h2>Probni period je aktivan</h2><p className="muted">Sve funkcije iz paketa <b>{String(subscription?.plan||'basic').toUpperCase()}</b> rade do {date(subscription?.trial_ends_at)}. Pretplatu možete aktivirati bilo kada.</p></div></div>}
    {!providerActive&&canManage&&<div className="grid subscription-choice-grid">
      <div className="card subscription-choice"><CreditCard/><h3>Basic</h3><strong>1.250 RSD + PDV</strong><p>po korisniku / mesečno</p><button className="btn btn-primary" onClick={()=>checkout('basic')} disabled={!!busy}>{busy==='basic'?'Otvaram…':'Aktiviraj Basic'}</button></div>
      <div className="card subscription-choice premium"><CreditCard/><h3>Premium</h3><strong>1.790 RSD + PDV</strong><p>po korisniku / mesečno</p><button className="btn btn-brand-green" onClick={()=>checkout('premium')} disabled={!!busy}>{busy==='premium'?'Otvaram…':'Aktiviraj Premium'}</button></div>
    </div>}
    {!canManage&&<div className="card subscription-live-card"><p>Za promenu pretplate obratite se administratoru ovog FiscalBox naloga.</p></div>}
    {error&&<div className="error">{error}</div>}
  </div>;
}
