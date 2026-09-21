import { createClient } from "@/lib/supabase/server";

function cell(v:unknown) {
  const s = String(v ?? "");
  return `"${s.replaceAll('"','""')}"`;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data:{user} } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized",{status:401});

  const url = new URL(request.url);
  const org = url.searchParams.get("organization_id");
  if (!org) return new Response("Missing organization_id",{status:400});

  const { data, error } = await supabase.from("receipts")
    .select("sdc_time,created_at,merchant_name,merchant_pib,invoice_number,total_amount,total_tax,payment_method,buyer_pib,category,note,verification_status,qr_url")
    .eq("organization_id",org)
    .order("sdc_time",{ascending:false});

  if (error) return new Response(error.message,{status:400});
  const header = ["Datum","Dobavljač","PIB dobavljača","Broj računa","Iznos","PDV","Plaćanje","PIB kupca","Kategorija","Napomena","Status","QR URL"];
  const rows = (data||[]).map(r=>[
    r.sdc_time||r.created_at,r.merchant_name,r.merchant_pib,r.invoice_number,r.total_amount,r.total_tax,r.payment_method,r.buyer_pib,r.category,r.note,r.verification_status,r.qr_url
  ].map(cell).join(";"));
  const csv = "\uFEFF"+header.map(cell).join(";")+"\n"+rows.join("\n");
  return new Response(csv,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":'attachment; filename="fiskalni-racuni.csv"'}});
}
