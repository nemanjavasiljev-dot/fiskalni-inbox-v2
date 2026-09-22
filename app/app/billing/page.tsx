import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BrandWordmark from "@/components/BrandWordmark";
import AccountantDesktopMenu from "@/components/AccountantDesktopMenu";
import { Download, FileText } from "lucide-react";

const money=(v:any)=>new Intl.NumberFormat("sr-RS",{style:"currency",currency:"RSD"}).format(Number(v||0));
const date=(v:any)=>v?new Intl.DateTimeFormat("sr-RS",{dateStyle:"medium"}).format(new Date(v)):"-";

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const supabase = await createClient();
  const { data:{user} } = await supabase.auth.getUser();
  if(!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("*").eq("user_id",user.id).single();
  if(!profile) redirect("/login");
  const { data: memberships } = await supabase.from("organization_members")
    .select("organization_id,role,organizations(id,name,pib,organization_type,owner_user_id)")
    .eq("user_id",user.id).in("role",["owner","employee"]);
  const owned=(memberships||[]).map((m:any)=>({organization_id:m.organization_id,role:m.role,...m.organizations}));
  const ids=owned.map((o:any)=>o.organization_id);
  const sp=await searchParams;
  const status=["paid","unpaid","cancelled"].includes(sp.status||"")?sp.status:"all";
  let invoices:any[]=[];
  if(ids.length){
    let q=supabase.from("billing_invoices").select("*").in("organization_id",ids).order("issued_at",{ascending:false});
    if(status!=="all")q=q.eq("status",status);
    const {data}=await q; invoices=data||[];
  }
  const isAccountant=profile.global_role==="accountant";
  const isAdmin=owned.some((o:any)=>o.organization_type==="accounting"&&o.owner_user_id===user.id);
  const counts={paid:invoices.filter(i=>i.status==="paid").length,unpaid:invoices.filter(i=>i.status==="unpaid").length};
  const content=<>
    <div className="app-head"><div><span className="pill"><FileText size={13}/> NAPLATA</span><h1>Moji racuni</h1><p className="muted">Arhiva FiscalBox predracuna i racuna, sa statusom placanja i PDF preuzimanjem.</p></div></div>
    <div className="grid stats billing-stats"><div className="card stat"><span>Ukupno</span><strong>{invoices.length}</strong></div><div className="card stat"><span>Placeno</span><strong>{counts.paid}</strong></div><div className="card stat"><span>Neplaceno</span><strong>{counts.unpaid}</strong></div><div className="card stat"><span>Ukupna vrednost</span><strong>{money(invoices.reduce((s:number,i:any)=>s+Number(i.total_amount||0),0))}</strong></div></div>
    <div className="billing-filter"><a className={status==="all"?"active":""} href="/app/billing">Svi</a><a className={status==="unpaid"?"active":""} href="/app/billing?status=unpaid">Neplaceni</a><a className={status==="paid"?"active":""} href="/app/billing?status=paid">Placeni</a></div>
    <div className="card billing-table"><div className="table-wrap"><table><thead><tr><th>Broj</th><th>Datum</th><th>Firma</th><th>Paket</th><th>Iznos</th><th>Status</th><th>PDF</th></tr></thead><tbody>{invoices.map((i:any)=><tr key={i.id}><td><b>{i.invoice_number}</b><div className="muted" style={{fontSize:10}}>{i.document_type==="proforma"?"Predracun":"Racun"}</div></td><td>{date(i.issued_at)}</td><td>{i.recipient_name}</td><td>{String(i.plan||"").toUpperCase()} · {i.quantity} korisnik(a)</td><td><b>{money(i.total_amount)}</b><div className="muted" style={{fontSize:10}}>sa PDV</div></td><td><span className={`billing-status ${i.status}`}>{i.status==="paid"?"PLACENO":i.status==="cancelled"?"STORNIRANO":"NEPLACENO"}</span></td><td><a className="btn" href={`/api/billing/invoices/${i.id}/pdf`}><Download size={15}/> PDF</a></td></tr>)}{!invoices.length&&<tr><td colSpan={7}><div className="empty-state">Jos nema izdatih racuna za izabrani filter.</div></td></tr>}</tbody></table></div></div>
  </>;
  return <div className={`app-shell ${isAccountant?"accountant-shell":""}`}><header className="appbar"><div className="container appbar-in"><a className="brand" href="/app"><span className="logo">F</span><BrandWordmark suffix={isAccountant?" · KNJIGO":""}/></a><div className="actions"><a className="btn" href="/app">← Nazad</a><form method="post" action="/api/auth/logout"><button className="btn">Odjava</button></form></div></div></header>{isAccountant?<div className="accountant-desktop-layout"><AccountantDesktopMenu isAdmin={isAdmin}/><main className="app-main accountant-main">{content}</main></div>:<main className="container app-main">{content}</main>}</div>;
}
