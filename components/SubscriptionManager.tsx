'use client';
import { useState } from 'react';
import { Landmark, Mail, ShieldCheck } from 'lucide-react';

function date(v?:string|null){return v?new Intl.DateTimeFormat('sr-RS',{dateStyle:'long'}).format(new Date(v)):'—';}

export default function SubscriptionManager({organization,subscription,canManage=true}:{organization:any;subscription:any;canManage?:boolean}){
  const [busy,setBusy]=useState('');const [error,setError]=useState('');const [message,setMessage]=useState('');
  const status=String(subscription?.status||'pending_checkout');
  const trialActive=status==='trial'&&subscription?.trial_ends_at&&new Date(subscription.trial_ends_at).getTime()>Date.now();
  const bankActive=subscription?.provider==='bank_transfer'&&status==='active'&&new Date(subscription?.current_period_end||subscription?.renews_at||0).getTime()>Date.now();
  const providerActive=Boolean(subscription?.provider_subscription_id)&&(['active','paused','past_due'].includes(status)||(status==='cancelled'&&new Date(subscription?.ends_at||subscription?.current_period_end||0).getTime()>Date.now()));
  async function selectPlan(plan:'basic'|'premium'){
    setBusy(plan);setError('');setMessage('');
    try{
      const r=await fetch('/api/subscriptions/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organization_id:organization.id||organization.organization_id,plan})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||'Predračun nije mogao da se kreira.');
      setMessage(d.message||'Predračun je kreiran i poslat.');window.location.href=d.url||'/app/billing?status=unpaid';
    }catch(e:any){setError(e.message||'Predračun nije mogao da se kreira.');setBusy('');}
  }
  return <div className="subscription-manager">
    <div className="grid subscription-kpis">
      <div className="card stat"><span>Paket</span><strong>{String(subscription?.plan||organization.plan||'basic').toUpperCase()}</strong></div>
      <div className="card stat"><span>Status</span><strong>{status.toUpperCase()}</strong></div>
      <div className="card stat"><span>Korisnici</span><strong>{subscription?.seat_count||1}</strong></div>
      <div className="card stat"><span>{trialActive?'Trial do':'Važi do / obnova'}</span><strong className="subscription-date-value">{date(trialActive?subscription?.trial_ends_at:subscription?.renews_at||subscription?.current_period_end)}</strong></div>
    </div>
    {bankActive&&<div className="card subscription-live-card"><div><span className="pill">AKTIVNA PRETPLATA</span><h2>Uplata je verifikovana</h2><p className="muted">Pretplata je aktivna do {date(subscription?.current_period_end||subscription?.renews_at)}. Finalni račun je u rubrici Moji računi → Plaćeno.</p></div><a className="btn" href="/app/billing?status=paid">Moji računi</a></div>}
    {providerActive&&canManage?<div className="card subscription-live-card"><div><span className="pill">AKTIVNA PRETPLATA</span><h2>Online pretplata</h2><p className="muted">Postojeća provider pretplata je aktivna.</p></div><a className="btn" href={`/api/subscriptions/portal?organization_id=${encodeURIComponent(organization.id||organization.organization_id)}`}>Upravljaj</a></div>:null}
    {trialActive&&<div className="card subscription-live-card"><div><span className="pill">10 DANA BESPLATNO</span><h2>Probni period je aktivan</h2><p className="muted">Predračun možete zatražiti odmah; trial ostaje aktivan do {date(subscription?.trial_ends_at)}.</p></div></div>}
    {!bankActive&&!providerActive&&canManage&&<div className="grid subscription-choice-grid">
      <div className="card subscription-choice"><Landmark/><h3>Basic</h3><strong>1.250 RSD</strong><p>po korisniku / mesečno · bez PDV-a</p><button className="btn btn-primary" onClick={()=>selectPlan('basic')} disabled={!!busy}>{busy==='basic'?'Kreiram predračun…':'Izaberi Basic'}</button></div>
      <div className="card subscription-choice premium"><Landmark/><h3>Premium</h3><strong>2.000 RSD</strong><p>po korisniku / mesečno · bez PDV-a</p><button className="btn btn-brand-green" onClick={()=>selectPlan('premium')} disabled={!!busy}>{busy==='premium'?'Kreiram predračun…':'Izaberi Premium'}</button></div>
    </div>}
    <div className="card" style={{marginTop:16}}><div style={{display:'flex',gap:12,alignItems:'flex-start'}}><Mail size={20}/><div><b>Kako radi naplata</b><p className="muted" style={{marginBottom:0}}>Izbor paketa automatski kreira PDF predračun sa NBS IPS QR kodom, šalje ga na email i stavlja u Moji računi → Neplaćeno. Nakon verifikovane bankarske uplate FiscalBox izdaje finalni račun i premešta ga u Plaćeno.</p></div></div></div>
    {error&&<div className="error">{error}</div>}{message&&<div className="home-message">{message}</div>}
    <p className="subscription-secure"><ShieldCheck size={15}/> Izdavalac OSKAR ZOMBORI PR ALSET CO. nije u sistemu PDV-a; PDV se ne obračunava.</p>
  </div>;
}
