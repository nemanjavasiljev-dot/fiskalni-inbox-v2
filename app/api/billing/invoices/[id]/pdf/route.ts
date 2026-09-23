import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildBillingPdf } from "@/lib/simple-pdf";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });
  const { id } = await params;
  const { data: invoice, error } = await supabase.from("billing_invoices").select("*").eq("id", id).maybeSingle();
  if (error || !invoice) return NextResponse.json({ error: "Račun nije pronađen." }, { status: 404 });
  if (invoice.external_invoice_url) return NextResponse.redirect(String(invoice.external_invoice_url));
  try {
    const pdf = buildBillingPdf(invoice);
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${invoice.invoice_number}.pdf"`, "Cache-Control": "private, no-store" } });
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || "PDF nije dostupan." }, { status: 409 });
  }
}
