"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const DEMO: Record<string, { password: string; role: string }> = {
  user: { password: "user", role: "company" },
  knjigo: { password: "knjigo", role: "accountant" },
  master: { password: "master", role: "master" }
};

export default function LoginPanel() {
  const [username,setUsername] = useState("");
  const [password,setPassword] = useState("");
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const plan = params.get("plan") || "basic";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const u = username.trim().toLowerCase();

    if (DEMO[u] && DEMO[u].password === password) {
      sessionStorage.setItem("fi_demo", JSON.stringify({ username:u, role:DEMO[u].role }));
      router.push("/demo");
      return;
    }

    setBusy(true);
    try {
      const r = await fetch("/api/auth/username-login", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({ username:u, password })
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
        <button className="btn btn-primary" style={{width:"100%",marginTop:16}} disabled={busy}>{busy ? "Prijava…" : "Prijavi se"}</button>
      </form>

      <div className="divider">ili</div>
      <a className="btn" style={{width:"100%"}} href={"/auth/google?plan="+encodeURIComponent(plan)}>
        <span style={{fontWeight:900}}>G</span> Registruj se / prijavi preko Google-a
      </a>

      <div className="demo-box">
        <b>Demo nalozi</b><br/>
        Firma: <span className="mono">user / user</span><br/>
        Knjigovođa: <span className="mono">knjigo / knjigo</span><br/>
        Master admin: <span className="mono">master / master</span>
      </div>
    </>
  );
}
