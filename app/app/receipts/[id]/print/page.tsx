import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PrintButton from "./print-button";
import { money, dateTime } from "@/lib/format";

export default async function PrintReceipt({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{autoprint?:string}>}){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
  const {id}=await params;const sp=await searchParams;const {data:r}=await supabase.from("receipts").select("*").eq("id",id).maybeSingle();if(!r)notFound();
  return <main style={{maxWidth:760,margin:"30px auto",background:"#fff",padding:30}}>
    <PrintButton autoPrint={sp.autoprint==="1"}/>
    <div style={{borderBottom:"2px solid #0f6b4f",paddingBottom:18,marginBottom:22}}><b style={{color:"#0f6b4f"}}>FISKALNI INBOX</b><h1>Fiskalni račun</h1></div>
    <table style={{minWidth:0}}><tbody>
      <tr><th>Dobavljač</th><td>{r.merchant_name||"—"}</td></tr><tr><th>PIB</th><td>{r.merchant_pib||"—"}</td></tr><tr><th>Broj računa</th><td>{r.invoice_number||"—"}</td></tr><tr><th>Datum</th><td>{dateTime(r.sdc_time||r.created_at)}</td></tr><tr><th>Iznos</th><td><b>{money(r.total_amount)}</b></td></tr><tr><th>PDV</th><td>{money(r.total_tax)}</td></tr><tr><th>Plaćanje</th><td>{r.payment_method||"—"}</td></tr><tr><th>Kategorija</th><td>{r.category}</td></tr><tr><th>Napomena</th><td>{r.note||"—"}</td></tr>
    </tbody></table>
    <p className="muted" style={{marginTop:24,fontSize:12}}>Originalna verifikacija: <a href={r.qr_url}>{r.qr_url}</a></p>
  </main>
}
