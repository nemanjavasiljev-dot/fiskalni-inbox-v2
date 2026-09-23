import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SetupForm from "./setup-form";
import BrandWordmark from "@/components/BrandWordmark";

export default async function SetupPage() {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  return <main className="auth-wrap"><div className="card setup-card"><a className="brand" href="/app"><span className="logo">F</span><BrandWordmark/></a><span className="pill" style={{marginTop:22}}>PRVI KORAK</span><h1>Povežite kompaniju</h1><p className="muted">Unesite PIB ili matični broj. Kada je APR API aktiviran, podaci se automatski povlače i ostaje samo da ih potvrdite.</p><SetupForm/></div></main>;
}
