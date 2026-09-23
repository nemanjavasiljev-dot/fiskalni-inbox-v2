"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPanel() {
  const [username,setUsername] = useState("");
  const [password,setPassword] = useState("");
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  const router = useRouter();

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
      <form onSubmit={submit}>
        <div className="field"><label>Korisničko ime</label><input className="input" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required /></div>
        <div className="field"><label>Lozinka</label><input className="input" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required /></div>
        {error && <div className="error">{error}</div>}
        <button className="btn btn-primary auth-login-submit" style={{width:"100%",marginTop:16}} disabled={busy}>{busy ? "Prijava…" : "Prijavi se"}</button>
        <div style={{textAlign:"right",marginTop:10,fontSize:12}}><a href="/forgot-password"><b>Zaboravljena lozinka?</b></a></div>
      </form>
      <div className="divider">novi korisnik</div>
      <a className="btn btn-accent" style={{width:"100%"}} href="/register">Registruj se</a>
      <p className="muted" style={{fontSize:12,marginTop:14,textAlign:'center'}}>Prijava je povezana sa vašim produkcionim FiscalBox nalogom.</p>
    </>
  );
}
