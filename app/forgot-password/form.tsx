"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
export default function ForgotPasswordForm(){
  const [email,setEmail]=useState("");const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const [error,setError]=useState("");
  async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");setMessage("");try{const supabase=createClient();const redirectTo=`${window.location.origin}/auth/callback?next=${encodeURIComponent('/reset-password')}`;const {error}=await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(),{redirectTo});if(error)throw error;setMessage("Ako nalog sa tim emailom postoji, link za promenu lozinke je poslat.");}catch(e:any){setError(e?.message||"Slanje recovery linka nije uspelo.");}finally{setBusy(false)}}
  return <form onSubmit={submit}><div className="field"><label>Email</label><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></div>{message&&<div className="home-message">{message}</div>}{error&&<div className="error">{error}</div>}<button className="btn btn-primary" style={{width:"100%",marginTop:16}} disabled={busy}>{busy?"Šaljem…":"Pošalji link"}</button></form>
}
