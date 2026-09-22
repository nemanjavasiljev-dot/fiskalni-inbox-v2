"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
export default function ResetPasswordForm(){
  const [password,setPassword]=useState("");const [confirm,setConfirm]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");const router=useRouter();
  async function submit(e:React.FormEvent){e.preventDefault();setError("");if(password.length<8)return setError("Lozinka mora imati najmanje 8 znakova.");if(password!==confirm)return setError("Lozinke se ne poklapaju.");setBusy(true);try{const supabase=createClient();const {error}=await supabase.auth.updateUser({password});if(error)throw error;router.push('/app');router.refresh();}catch(e:any){setError(e?.message||"Lozinka nije promenjena. Otvorite novi recovery link.");}finally{setBusy(false)}}
  return <form onSubmit={submit}><div className="field"><label>Nova lozinka</label><input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="new-password"/></div><div className="field"><label>Ponovite lozinku</label><input className="input" type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} required autoComplete="new-password"/></div>{error&&<div className="error">{error}</div>}<button className="btn btn-primary" style={{width:"100%",marginTop:16}} disabled={busy}>{busy?"Čuvam…":"Sačuvaj novu lozinku"}</button></form>
}
