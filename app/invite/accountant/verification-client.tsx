'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';

export default function AccountantVerificationClient({token}:{token:string}){
  const [state,setState]=useState<'loading'|'success'|'register'|'error'>('loading');
  const [message,setMessage]=useState('Verifikujemo zahtev za prijem novog klijenta…');
  const [company,setCompany]=useState<any>(null);

  useEffect(()=>{
    let cancelled=false;
    async function run(){
      if(!token){setState('error');setMessage('Verifikacioni link nije kompletan.');return;}
      try{
        const lookup=await fetch(`/api/accountant-invite/lookup?token=${encodeURIComponent(token)}`,{cache:'no-store'});
        const l=await lookup.json();
        if(!lookup.ok)throw new Error(l.error||'Poziv nije pronađen.');
        if(cancelled)return;
        setCompany(l.company||null);
        if(l.alreadyAccepted){setState('success');setMessage(l.message||'Klijent je već dodat.');return;}
        const accept=await fetch('/api/accountant-invite/accept',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
        const a=await accept.json();
        if(cancelled)return;
        if(accept.ok){setState('success');setMessage(a.message||'Klijent je dodat u vaš dashboard.');setTimeout(()=>{window.location.href=a.redirect||'/app'},1800);return;}
        if(a.code==='ACCOUNTANT_NOT_REGISTERED'){setState('register');setMessage(a.error||'Prvo registrujte FiscalBox nalog knjigovođe.');return;}
        throw new Error(a.error||'Verifikacija nije uspela.');
      }catch(e:any){if(!cancelled){setState('error');setMessage(e.message||'Verifikacija nije uspela.');}}
    }
    run();return()=>{cancelled=true};
  },[token]);

  return <div className="invite-activate">
    <span className="pill">VERIFIKACIJA KNJIGOVOĐE</span>
    {state==='loading'&&<><ShieldCheck size={44}/><h1>Proveravamo zahtev</h1><p className="muted">{message}</p></>}
    {state==='success'&&<><CheckCircle2 size={44}/><h1>Klijent je prihvaćen</h1><p>{message}</p>{company&&<div className="demo-box"><b>{company.name}</b>{company.pib&&<><br/>PIB {company.pib}</>}</div>}<p className="muted">Otvaramo FiscalBox dashboard…</p><a className="btn btn-primary" href="/app">Otvori dashboard</a></>}
    {state==='register'&&<><ShieldCheck size={44}/><h1>Potrebna je registracija knjigovođe</h1><p>{message}</p>{company&&<div className="demo-box">Klijent: <b>{company.name}</b>{company.pib&&<> · PIB {company.pib}</>}</div>}<p className="muted">Registrujte knjigovodstvenu firmu koristeći isti PIB i email na koji je stigao ovaj poziv. FiscalBox će zatim automatski povezati klijenta.</p><a className="btn btn-primary" href="/register">Registruj knjigovođu</a></>}
    {state==='error'&&<><h1>Verifikacija nije uspela</h1><div className="error">{message}</div><a className="btn" href="/login">Idi na prijavu</a></>}
  </div>;
}
