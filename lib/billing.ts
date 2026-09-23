import { buildBillingPdf } from '@/lib/simple-pdf';
import { paymentReferenceFromDocumentNumber, buildIpsPaymentString, validateIpsTextWithNbs } from '@/lib/ips-payment';
import { sendBillingInvoiceEmail } from '@/lib/mailer';

export const PLAN_PRICES: Record<string, number> = { basic: 1250, premium: 2000 };
export const VAT_RATE = 0;

function addCalendarMonth(date: Date) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  return d;
}
function addDays(date: Date, days: number) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }

async function nextDocumentNumber(admin: any, type: 'proforma'|'invoice') {
  const { data, error } = await admin.rpc('next_billing_document_number', { p_document_type: type });
  if (error || !data) throw new Error(error?.message || 'Broj dokumenta nije mogao da se generiše. Pokrenite SQL 017.');
  return String(data);
}

async function getIssuer(admin: any) {
  const { data: issuer, error } = await admin.from('billing_issuer_settings')
    .select('*').eq('active', true).eq('is_demo', false).order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (error) throw error;
  if (!issuer) throw new Error('Produkcioni izdavalac nije podešen u MASTER > Računi / predračuni.');
  if (String(issuer.pib || '') === '115266735' && Number(issuer.vat_rate || 0) !== 0) {
    throw new Error('ALSET CO. nije u sistemu PDV-a. VAT stopa izdavaoca mora biti 0%.');
  }
  if (!String(issuer.bank_account || '').trim()) throw new Error('Unesite dinarski račun ALSET CO. u MASTER > Računi / predračuni pre izdavanja predračuna.');
  return issuer;
}

export async function createPlanProforma(opts: { admin: any; organization: any; plan: string; seats?: number; recipientEmail?: string; appBillingUrl?: string }) {
  if (!PLAN_PRICES[opts.plan]) return { invoice: null, email: null, reused: false };
  const seats = Math.max(1, Number(opts.seats || 1));
  const unit = PLAN_PRICES[opts.plan];
  const subtotal = unit * seats;
  const issuer = await getIssuer(opts.admin);
  const vatRate = 0;
  const vat = 0;
  const total = subtotal;

  // Ne pravimo duplikat ako za isti paket/seat već postoji otvoren predračun.
  const { data: existing } = await opts.admin.from('billing_invoices').select('*')
    .eq('organization_id', opts.organization.id).eq('document_type', 'proforma').eq('status', 'unpaid')
    .eq('plan', opts.plan).eq('quantity', seats).order('issued_at', { ascending: false }).limit(1).maybeSingle();
  if (existing) {
    let emailResult: any = null;
    if (opts.recipientEmail) {
      emailResult = await sendBillingInvoiceEmail({
        to: opts.recipientEmail, organizationName: opts.organization.name, invoiceNumber: existing.invoice_number,
        plan: opts.plan, totalAmount: Number(existing.total_amount || total), billingUrl: opts.appBillingUrl || '', pdf: buildBillingPdf(existing), documentType: 'proforma'
      });
      if (emailResult?.sent) await opts.admin.from('billing_invoices').update({ emailed_at: new Date().toISOString(), recipient_email: opts.recipientEmail }).eq('id', existing.id);
    }
    return { invoice: existing, email: emailResult, reused: true };
  }

  // Stari neplaćeni predračuni se zatvaraju kada korisnik izabere novi paket.
  await opts.admin.from('billing_invoices').update({ status: 'cancelled' })
    .eq('organization_id', opts.organization.id).eq('document_type', 'proforma').eq('status', 'unpaid');

  const invoiceNumber = await nextDocumentNumber(opts.admin, 'proforma');
  const paymentReference = paymentReferenceFromDocumentNumber(invoiceNumber);
  const now = new Date();
  const dueAt = addDays(now, 7).toISOString().slice(0, 10);
  const payload: any = {
    organization_id: opts.organization.id,
    company_id: opts.organization.company_id || null,
    invoice_number: invoiceNumber,
    document_type: 'proforma',
    plan: opts.plan,
    quantity: seats,
    unit_price_net: unit,
    subtotal_net: subtotal,
    vat_rate: vatRate,
    vat_amount: vat,
    total_amount: total,
    currency: 'RSD',
    status: 'unpaid',
    issued_at: now.toISOString(),
    due_at: dueAt,
    recipient_name: opts.organization.name,
    recipient_pib: opts.organization.pib || null,
    recipient_registration_number: opts.organization.registration_number || null,
    recipient_address: opts.organization.address || null,
    recipient_email: opts.recipientEmail || null,
    issuer_snapshot: issuer,
    provider: 'bank_transfer',
    payment_reference: paymentReference,
    note: 'Predračun za mesečnu FiscalBox pretplatu. Finalni račun se izdaje nakon verifikovane uplate.'
  };

  // Tehnička NBS provera IPS stringa je best-effort i ne blokira kreiranje dokumenta ako je servis privremeno nedostupan.
  try {
    const ips = buildIpsPaymentString({ bankAccount: issuer.bank_account, payeeName: issuer.company_name, amount: total, paymentCode: issuer.payment_code || '221', purpose: `FiscalBox ${invoiceNumber}`, paymentReference });
    const validation = await validateIpsTextWithNbs(ips);
    payload.note += validation.checked ? (validation.valid ? ' NBS IPS QR tehnički proveren.' : ` NBS validator prijavio: ${(validation.errors || []).join('; ').slice(0, 250)}`) : ' NBS validator trenutno nije bio dostupan; QR je generisan po objavljenoj NBS specifikaciji.';
  } catch (e: any) {
    payload.note += ` IPS QR upozorenje: ${String(e?.message || e).slice(0, 250)}`;
  }

  const { data: invoice, error } = await opts.admin.from('billing_invoices').insert(payload).select('*').single();
  if (error) throw error;

  let emailResult: any = null;
  if (opts.recipientEmail) {
    const pdf = buildBillingPdf(invoice);
    emailResult = await sendBillingInvoiceEmail({
      to: opts.recipientEmail, organizationName: opts.organization.name, invoiceNumber,
      plan: opts.plan, totalAmount: total, billingUrl: opts.appBillingUrl || '', pdf, documentType: 'proforma'
    });
    if (emailResult?.sent) await opts.admin.from('billing_invoices').update({ emailed_at: new Date().toISOString() }).eq('id', invoice.id);
  }
  return { invoice, email: emailResult, reused: false };
}

export async function settleProforma(opts: {
  admin: any;
  proformaId: string;
  bankTransactionId?: string | null;
  verifiedBy?: string | null;
  verificationSource?: string;
  paidAt?: string | null;
  appBillingUrl?: string;
}) {
  const { data: proforma, error: proformaError } = await opts.admin.from('billing_invoices').select('*').eq('id', opts.proformaId).maybeSingle();
  if (proformaError || !proforma) throw new Error(proformaError?.message || 'Predračun nije pronađen.');
  if (proforma.document_type !== 'proforma') throw new Error('Izabrani dokument nije predračun.');

  const { data: already } = await opts.admin.from('billing_invoices').select('*').eq('source_proforma_id', proforma.id).eq('document_type', 'invoice').limit(1).maybeSingle();
  if (already) return { invoice: already, alreadySettled: true };
  if (!['unpaid','converted'].includes(String(proforma.status))) throw new Error('Predračun nije otvoren za rasknjižavanje.');

  const paidAt = opts.paidAt || new Date().toISOString();
  const invoiceNumber = await nextDocumentNumber(opts.admin, 'invoice');
  const start = new Date(paidAt);
  const end = addCalendarMonth(start);
  const payload: any = {
    organization_id: proforma.organization_id,
    company_id: proforma.company_id || null,
    invoice_number: invoiceNumber,
    document_type: 'invoice',
    plan: proforma.plan,
    quantity: proforma.quantity,
    unit_price_net: proforma.unit_price_net,
    subtotal_net: proforma.subtotal_net,
    vat_rate: 0,
    vat_amount: 0,
    total_amount: proforma.total_amount,
    currency: proforma.currency || 'RSD',
    status: 'paid',
    issued_at: paidAt,
    paid_at: paidAt,
    recipient_name: proforma.recipient_name,
    recipient_pib: proforma.recipient_pib,
    recipient_registration_number: proforma.recipient_registration_number || null,
    recipient_address: proforma.recipient_address,
    recipient_email: proforma.recipient_email,
    issuer_snapshot: proforma.issuer_snapshot,
    provider: 'bank_transfer',
    payment_reference: proforma.payment_reference,
    source_proforma_id: proforma.id,
    bank_transaction_id: opts.bankTransactionId || null,
    verification_source: opts.verificationSource || (opts.bankTransactionId ? 'BANK_API' : 'MASTER_RUČNA_VERIFIKACIJA'),
    verified_at: new Date().toISOString(),
    service_period_start: start.toISOString().slice(0,10),
    service_period_end: end.toISOString().slice(0,10),
    note: `Finalni račun po predračunu ${proforma.invoice_number}. Uplata verifikovana u FiscalBox sistemu.`
  };
  const { data: invoice, error } = await opts.admin.from('billing_invoices').insert(payload).select('*').single();
  if (error) throw error;

  await opts.admin.from('billing_invoices').update({
    status: 'converted', paid_at: paidAt, verified_at: new Date().toISOString(),
    verification_source: payload.verification_source, bank_transaction_id: opts.bankTransactionId || null
  }).eq('id', proforma.id);

  await opts.admin.from('subscriptions').update({
    plan: proforma.plan, seat_count: proforma.quantity, provider: 'bank_transfer', status: 'active',
    activated_at: paidAt, last_payment_at: paidAt, current_period_end: end.toISOString(), renews_at: end.toISOString(),
    provider_status: 'paid', payment_processor: opts.bankTransactionId ? 'bank_api' : 'manual_bank_verification'
  }).eq('organization_id', proforma.organization_id);
  await opts.admin.from('organizations').update({ plan: proforma.plan, status: 'active', service_block_reason: null, service_blocked_at: null }).eq('id', proforma.organization_id);

  if (opts.bankTransactionId) {
    await opts.admin.from('bank_transactions').update({
      status: 'matched', matched_invoice_id: invoice.id, matched_organization_id: proforma.organization_id,
      verified_by: opts.verifiedBy || null, verified_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }).eq('id', opts.bankTransactionId);
  }

  let email: any = null;
  if (proforma.recipient_email) {
    email = await sendBillingInvoiceEmail({
      to: proforma.recipient_email, organizationName: proforma.recipient_name, invoiceNumber,
      plan: proforma.plan, totalAmount: Number(proforma.total_amount || 0), billingUrl: opts.appBillingUrl || '',
      pdf: buildBillingPdf(invoice), documentType: 'invoice'
    });
    if (email?.sent) await opts.admin.from('billing_invoices').update({ emailed_at: new Date().toISOString() }).eq('id', invoice.id);
  }
  return { invoice, email, alreadySettled: false };
}
