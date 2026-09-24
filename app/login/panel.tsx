"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import InstallAppButton from "@/components/InstallAppButton";

export default function LoginPanel() {
  const [username,setUsername] = useState("");
  const [password,setPassword] = useState("");
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  const router = useRouter();
  const [notice,setNotice]=useState("");
  const [showResend,setShowResend]=useState(false);
  const [verifyEmail,setVerifyEmail]=useState("");
  const [resendBusy,setResendBusy]=useState(false);
  const [resendMessage,setResendMessage]=useState("");
  const [showInstallGate,setShowInstallGate]=useState(false);

  useEffect(()=>{
    const qs=new URLSearchParams(window.location.search);
    if(qs.get("registered")){
      const inviteInfo=qs.get("accountant_invite")?" Poziv knjigovođi je takođe poslat na uneti kontakt.":"";
      const registeredEmail=qs.get("email")||"";
      if(registeredEmail)setVerifyEmail(registeredEmail);
      if(qs.get("mail_error")){
        const detail=qs.get("mail_detail");
        setNotice(`Nalog je kreiran, ali verifikacioni email nije isporučen iz aplikacije.${detail?` Razlog: ${detail}`:""} Unesite email ispod i kliknite „Pošalji ponovo“.${inviteInfo}`);
      }else{
        setNotice(`Nalog je kreiran. Verifikacioni email je poslat sa FiscalBox adrese.${inviteInfo} Otvorite email i potvrdite nalog, pa se prijavite.`);
      }
      setShowResend(true);
    }
    if(qs.get("verified"))setNotice("Email je potvrđen. Sada se možete prijaviti u FiscalBox.");
    const nav=navigator as Navigator & {standalone?:boolean};
    const standalone=window.matchMedia("(display-mode: standalone)").matches||nav.standalone===true;
    const mobile=/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)||window.matchMedia("(max-width: 820px)").matches;
    if(qs.get("install")&&mobile&&!standalone)setShowInstallGate(true);
  },[]);

  async function resendVerification(){
    setResendMessage("");
    const email=verifyEmail.trim().toLowerCase();
    if(!/^\S+@\S+\.\S+$/.test(email)){setResendMessage("Unesite email adresu naloga.");return;}
    setResendBusy(true);
    try{
      const r=await fetch('/api/auth/resend-verification',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});
      const d=await r.json();
      setResendMessage(d.message||d.error||(r.ok?'Email je poslat.':'Slanje nije uspelo.'));
    }catch{setResendMessage('Slanje trenutno nije dostupno.');}
    finally{setResendBusy(false);}
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const r = await fetch("/api/auth/username-login", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({ username:username.trim().toLowerCase(), password })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Prijava nije uspela.");
      router.push("/app");
      router.refresh();
    } catch (e:any) {
      setError(e.message || "Prijava nije uspela.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {notice&&<div className="home-message" role="status">{notice}</div>}
      {showResend&&<div className="verification-resend-box">
        <b>Niste dobili email?</b>
        <div className="verification-resend-row"><input className="input" type="email" placeholder="Email naloga" value={verifyEmail} onChange={e=>setVerifyEmail(e.target.value)}/><button type="button" className="btn" onClick={resendVerification} disabled={resendBusy}>{resendBusy?'Šaljem…':'Pošalji ponovo'}</button></div>
        {resendMessage&&<small>{resendMessage}</small>}
      </div>}
      <form onSubmit={submit}>
        <div className="field"><label>Korisničko ime ili email</label><input className="input" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required /></div>
        <div className="field"><label>Lozinka</label><input className="input" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required /></div>
        {error && <div className="error">{error}</div>}
        <button className="btn btn-primary auth-login-submit" style={{width:"100%",marginTop:16}} disabled={busy}>{busy ? "Prijava…" : "Prijavi se"}</button>
        <div style={{textAlign:"right",marginTop:10,fontSize:12}}><a href="/forgot-password"><b>Zaboravljena lozinka?</b></a></div>
      </form>
      <div className="divider">novi korisnik</div>
      <a className="btn btn-accent" style={{width:"100%"}} href="/register">Registruj se</a>
      <p className="muted" style={{fontSize:12,marginTop:14,textAlign:'center'}}>Prijava je povezana sa vašim produkcionim FiscalBox nalogom.</p>
      {showInstallGate&&<div className="mobile-install-gate"><div className="mobile-install-card"><span className="pill">MOBILNA APLIKACIJA</span><h2>Instalirajte FiscalBox na telefon</h2><p>Registracija je završena. Za brži rad, kameru i PUSH obaveštenja preporučujemo da FiscalBox sada dodate kao aplikaciju na telefon.</p><InstallAppButton/><div className="mobile-install-actions"><button type="button" className="btn" onClick={()=>setShowInstallGate(false)}>Nastavi bez instalacije</button></div><small>Pregledač ne dozvoljava da sajt potpuno sam instalira aplikaciju. FiscalBox zato odmah otvara najdirektniji dostupan postupak instalacije za vaš telefon.</small></div></div>}
    </>
  );
}
