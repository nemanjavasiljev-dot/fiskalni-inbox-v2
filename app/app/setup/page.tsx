import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SetupForm from "./setup-form";

export default async function SetupPage() {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  return <main className="auth-wrap"><div className="card auth-card"><span className="pill">PODEŠAVANJE</span><h1>Nova firma</h1><p className="muted">Unesite osnovne podatke. Plan možete promeniti kasnije.</p><SetupForm/></div></main>
}
