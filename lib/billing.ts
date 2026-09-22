import { randomUUID } from "crypto";
import { buildBillingPdf } from "@/lib/simple-pdf";
import { sendBillingInvoiceEmail } from "@/lib/mailer";

export const PLAN_NET_PRICES: Record<string, number> = { basic: 1250, premium: 1790 };
export const VAT_RATE = 20;

export async function createPlanProforma(opts: { admin: any; organization: any; plan: string; seats?: number; recipientEmail?: string; appBillingUrl?: string }) {
  if (!PLAN_NET_PRICES[opts.plan]) return { invoice: null, email: null };
  const seats = Math.max(1, Number(opts.seats || 1));
  const unit = PLAN_NET_PRICES[opts.plan];
  const subtotal = unit * seats;
  const vat = Math.round(subtotal * VAT_RATE) / 100;
  const total = subtotal + vat;
  const { data: issuer } = await opts.admin.from("billing_issuer_settings").select("*").eq("active", true).order("created_at", { ascending: true }).limit(1).maybeSingle();
  const invoiceNumber = `FB-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-${randomUUID().slice(0,6).toUpperCase()}`;
  const issuerSnapshot = issuer || { company_name: "FiscalBox Demo", pib: "000000000", address: "Demo izdavalac", email: "billing@fiscalbox.local", vat_rate: VAT_RATE, is_demo: true, note: "DEMO izdavalac - zameniti produkcionim podacima." };
  const payload = {
    organization_id: opts.organization.id,
    invoice_number: invoiceNumber,
    document_type: "proforma",
    plan: opts.plan,
    quantity: seats,
    unit_price_net: unit,
    subtotal_net: subtotal,
    vat_rate: VAT_RATE,
    vat_amount: vat,
    total_amount: total,
    currency: "RSD",
    status: "unpaid",
    issued_at: new Date().toISOString(),
    recipient_name: opts.organization.name,
    recipient_pib: opts.organization.pib || null,
    recipient_address: opts.organization.address || null,
    recipient_email: opts.recipientEmail || null,
    issuer_snapshot: issuerSnapshot
  };
  const { data: invoice, error } = await opts.admin.from("billing_invoices").insert(payload).select("*").single();
  if (error) throw error;
  let emailResult: any = null;
  if (opts.recipientEmail) {
    const pdf = buildBillingPdf(invoice);
    emailResult = await sendBillingInvoiceEmail({
      to: opts.recipientEmail,
      organizationName: opts.organization.name,
      invoiceNumber,
      plan: opts.plan,
      totalAmount: total,
      billingUrl: opts.appBillingUrl || "",
      pdf
    });
    if (emailResult?.sent) await opts.admin.from("billing_invoices").update({ emailed_at: new Date().toISOString() }).eq("id", invoice.id);
  }
  return { invoice, email: emailResult };
}
