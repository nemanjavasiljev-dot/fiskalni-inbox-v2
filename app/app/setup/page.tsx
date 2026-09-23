import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SetupForm from "./setup-form";
import BrandWordmark from "@/components/BrandWordmark";

export default async function SetupPage() {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  return <main className="auth-wrap"><div className="card setup-card"><a className="brand" href="/app"><span className="logo">F</span><BrandWordmark/></a><span className="pill" style={{marginTop:22}}>PRVI KORAK</span><h1>Povežite kompaniju</h1><p className="muted">Unesite naziv firme ili matični broj. Podaci se preuzimaju iz lokalno sinhronizovane APR baze i ostaje samo da izaberete svoju firmu.</p><SetupForm/></div></main>;
}
