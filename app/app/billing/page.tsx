import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BrandWordmark from "@/components/BrandWordmark";
import AccountantDesktopMenu from "@/components/AccountantDesktopMenu";
import { CreditCard, Download, FileText } from "lucide-react";

const money=(v:any,currency="RSD")=>new Intl.NumberFormat("sr-RS",{style:"currency",currency:String(currency||"RSD").toUpperCase()}).format(Number(v||0));
const date=(v:any)=>v?new Intl.DateTimeFormat("sr-RS",{dateStyle:"medium"}).format(new Date(v)):"-";
const statusLabel=(s:string)=>({paid:"PLAĆENO",unpaid:"NEPLAĆENO",cancelled:"STORNIRANO",refunded:"REFUNDIRANO",partial_refund:"DELIMIČNO REFUNDIRANO"} as any)[s]||String(s||"").toUpperCase();

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const supabase = await createClient();
  const { data:{user} } = await supabase.auth.getUser();
  if(!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("*").eq("user_id",user.id).single();
  if(!profile) redirect("/login");
  const { data: memberships } = await supabase.from("organization_members")
    .select("organization_id,role,accounting_access_role,organizations(id,name,pib,organization_type,owner_user_id)")
    .eq("user_id",user.id).in("role",["owner","employee"]);
  const owned=(memberships||[]).map((m:any)=>({organization_id:m.organization_id,role:m.role,accounting_access_role:m.accounting_access_role,...m.organizations}));
  const ids=owned.map((o:any)=>o.organization_id);
  const sp=await searchParams;
  const allowedStatuses=["paid","unpaid","cancelled","refunded","partial_refund"];
  const status=allowedStatuses.includes(sp.status||"")?String(sp.status):"all";
  let invoices:any[]=[];
  if(ids.length){
    let q=supabase.from("billing_invoices").select("*").in("organization_id",ids).order("issued_at",{ascending:false});
    if(status!=="all")q=q.eq("status",status);
    const {data}=await q; invoices=data||[];
  }
  const isAccountant=profile.global_role==="accountant";
  const accountingOrg=owned.find((o:any)=>o.organization_type==="accounting");
  const isAdmin=Boolean(accountingOrg&&(accountingOrg.owner_user_id===user.id||accountingOrg.accounting_access_role==="admin"));
  const counts={paid:invoices.filter(i=>i.status==="paid").length,unpaid:invoices.filter(i=>i.status==="unpaid").length};
  const content=<>
    <div className="app-head"><div><span className="pill"><FileText size={13}/> NAPLATA</span><h1>Moji računi</h1><p className="muted">Arhiva stvarnih FiscalBox dokumenata naplate i računa payment providera, sa statusom i PDF/preuzimanjem.</p></div><a className="btn btn-primary" href={`/app/subscription${accountingOrg?`?organization_id=${accountingOrg.organization_id}`:""}`}><CreditCard size={15}/> Pretplata</a></div>
    <div className="grid stats billing-stats"><div className="card stat"><span>Ukupno</span><strong>{invoices.length}</strong></div><div className="card stat"><span>Plaćeno</span><strong>{counts.paid}</strong></div><div className="card stat"><span>Neplaćeno</span><strong>{counts.unpaid}</strong></div><div className="card stat"><span>Ukupna vrednost</span><strong>{money(invoices.reduce((s:number,i:any)=>s+Number(i.total_amount||0),0),invoices[0]?.currency||"RSD")}</strong></div></div>
    <div className="billing-filter"><a className={status==="all"?"active":""} href="/app/billing">Svi</a><a className={status==="unpaid"?"active":""} href="/app/billing?status=unpaid">Neplaćeni</a><a className={status==="paid"?"active":""} href="/app/billing?status=paid">Plaćeni</a><a className={status==="refunded"?"active":""} href="/app/billing?status=refunded">Refundirani</a></div>
    <div className="card billing-table"><div className="table-wrap"><table><thead><tr><th>Broj</th><th>Datum</th><th>Firma</th><th>Paket</th><th>Iznos</th><th>Status</th><th>Izvor</th><th>Dokument</th></tr></thead><tbody>{invoices.map((i:any)=><tr key={i.id}><td><b>{i.invoice_number}</b><div className="muted" style={{fontSize:10}}>{i.document_type==="proforma"?"Predračun":"Račun"}</div></td><td>{date(i.issued_at)}</td><td>{i.recipient_name}</td><td>{String(i.plan||"").toUpperCase()} · {i.quantity} korisnik(a)</td><td><b>{money(i.total_amount,i.currency)}</b><div className="muted" style={{fontSize:10}}>evidentirano</div></td><td><span className={`billing-status ${i.status}`}>{statusLabel(i.status)}</span></td><td>{i.provider==="lemonsqueezy"?"ONLINE PRETPLATA":"FISCALBOX"}</td><td><a className="btn" href={`/api/billing/invoices/${i.id}/pdf`} target={i.external_invoice_url?"_blank":undefined}><Download size={15}/> {i.external_invoice_url?"Račun":"PDF"}</a></td></tr>)}{!invoices.length&&<tr><td colSpan={8}><div className="empty-state">Još nema dokumenata naplate za izabrani filter.</div></td></tr>}</tbody></table></div></div>
  </>;
  return <div className={`app-shell ${isAccountant?"accountant-shell":""}`}><header className="appbar"><div className="container appbar-in"><a className="brand" href="/app"><span className="logo">F</span><BrandWordmark suffix={isAccountant?" · KNJIGO":""}/></a><div className="actions"><a className="btn" href="/app">← Nazad</a><form method="post" action="/api/auth/logout"><button className="btn">Odjava</button></form></div></div></header>{isAccountant?<div className="accountant-desktop-layout"><AccountantDesktopMenu isAdmin={isAdmin}/><main className="app-main accountant-main">{content}</main></div>:<main className="container app-main">{content}</main>}</div>;
}
