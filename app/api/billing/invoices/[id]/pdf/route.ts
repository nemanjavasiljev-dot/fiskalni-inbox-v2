import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildBillingPdf } from "@/lib/simple-pdf";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });
  const { id } = await params;
  const { data: invoice, error } = await supabase.from("billing_invoices").select("*").eq("id", id).maybeSingle();
  if (error || !invoice) return NextResponse.json({ error: "Racun nije pronadjen." }, { status: 404 });
  const pdf = buildBillingPdf(invoice);
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${invoice.invoice_number}.pdf"`, "Cache-Control": "private, no-store" } });
}
