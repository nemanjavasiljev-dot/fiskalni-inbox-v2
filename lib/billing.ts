import { buildBillingPdf } from '@/lib/simple-pdf';
import { paymentReferenceFromDocumentNumber, buildIpsPaymentString, validateIpsTextWithNbs } from '@/lib/ips-payment';
import { sendBillingInvoiceEmail } from '@/lib/mailer';

export const PLAN_PRICES: Record<string, number> = { basic: 1250, premium: 1790 };
export const VAT_RATE = 0;

function addDays(date: Date, days: number) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }

function isoDate(value: string | Date) {
  const d = value instanceof Date ? value : new Date(value);
  return d.toISOString().slice(0, 10);
}

function daysInUtcMonth(year:number, monthIndex:number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Sledeca mesecna godisnjica posle datog datuma. Ako je anchor 29/30/31,
 * mesec bez tog dana koristi poslednji dan tog meseca, ali se originalni
 * anchor cuva za naredne mesece (npr. 31.01 -> 28.02 -> 31.03).
 */
export function nextMonthlyOccurrence(anchorDay:number, after:string|Date) {
  const d = after instanceof Date ? new Date(after) : new Date(after);
  const anchor = Math.min(31, Math.max(1, Number(anchorDay || 1)));
  let year = d.getUTCFullYear();
  let month = d.getUTCMonth();
  const candidateFor = (y:number,m:number) => {
    const day = Math.min(anchor, daysInUtcMonth(y,m));
    return new Date(Date.UTC(y,m,day));
  };
  let candidate = candidateFor(year, month);
  const afterDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  if (candidate.getTime() <= afterDate.getTime()) {
    month += 1;
    if (month > 11) { month = 0; year += 1; }
    candidate = candidateFor(year, month);
  }
  return isoDate(candidate);
}

async function nextDocumentNumber(admin: any, type: 'proforma'|'invoice') {
  const { data, error } = await admin.rpc('next_billing_document_number', { p_document_type: type });
  if (error || !data) throw new Error(error?.message || 'Broj dokumenta nije mogao da se generiše. Pokrenite SQL 022.');
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

type ProformaOptions = {
  admin: any;
  organization: any;
  plan: string;
  seats?: number;
  recipientEmail?: string;
  appBillingUrl?: string;
  billingCycleOn?: string | null;
  recurring?: boolean;
  resendExisting?: boolean;
};

async function emailExistingProforma(opts:ProformaOptions, existing:any, total:number) {
  if (!opts.recipientEmail || opts.resendExisting === false) return null;
  const emailResult = await sendBillingInvoiceEmail({
    to: opts.recipientEmail,
    organizationName: opts.organization.name,
    invoiceNumber: existing.invoice_number,
    plan: opts.plan,
    totalAmount: Number(existing.total_amount || total),
    billingUrl: opts.appBillingUrl || '',
    pdf: buildBillingPdf(existing),
    documentType: 'proforma'
  });
  if (emailResult?.sent) {
    await opts.admin.from('billing_invoices').update({ emailed_at: new Date().toISOString(), recipient_email: opts.recipientEmail }).eq('id', existing.id);
  }
  return emailResult;
}

export async function createPlanProforma(opts: ProformaOptions) {
  if (!PLAN_PRICES[opts.plan]) return { invoice: null, email: null, reused: false };
  const seats = Math.max(1, Number(opts.seats || 1));
  const unit = PLAN_PRICES[opts.plan];
  const subtotal = unit * seats;
  const issuer = await getIssuer(opts.admin);
  const vatRate = 0;
  const vat = 0;
  const total = subtotal;
  const cycleOn = opts.billingCycleOn ? String(opts.billingCycleOn).slice(0,10) : null;

  // Automatski mesecni ciklus je idempotentan: jedan predracun po organizaciji i datumu ciklusa.
  if (cycleOn) {
    const {data:cycleExisting} = await opts.admin.from('billing_invoices').select('*')
      .eq('organization_id', opts.organization.id).eq('document_type','proforma').eq('billing_cycle_on', cycleOn)
      .limit(1).maybeSingle();
    if (cycleExisting) {
      const emailResult = await emailExistingProforma(opts, cycleExisting, total);
      return {invoice:cycleExisting,email:emailResult,reused:true};
    }
  } else {
    // Rucno kreiranje ne pravi duplikat otvorenog predracuna za isti paket/seat.
    const { data: existing } = await opts.admin.from('billing_invoices').select('*')
      .eq('organization_id', opts.organization.id).eq('document_type', 'proforma').eq('status', 'unpaid')
      .eq('plan', opts.plan).eq('quantity', seats).order('issued_at', { ascending: false }).limit(1).maybeSingle();
    if (existing) {
      const emailResult = await emailExistingProforma(opts, existing, total);
      return { invoice: existing, email: emailResult, reused: true };
    }

    // Kod rucne promene paketa zatvaramo stare otvorene predracune.
    await opts.admin.from('billing_invoices').update({ status: 'cancelled' })
      .eq('organization_id', opts.organization.id).eq('document_type', 'proforma').eq('status', 'unpaid');
  }

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
    billing_cycle_on: cycleOn,
    note: opts.recurring
      ? `Automatski mesečni predračun za FiscalBox pretplatu${cycleOn?` (ciklus ${cycleOn})`:''}. Finalni račun se izdaje nakon verifikovane uplate.`
      : 'Predračun za mesečnu FiscalBox pretplatu. Finalni račun se izdaje nakon verifikovane uplate.'
  };

  try {
    const ips = buildIpsPaymentString({ bankAccount: issuer.bank_account, payeeName: issuer.company_name, amount: total, paymentCode: issuer.payment_code || '221', purpose: `FiscalBox ${invoiceNumber}`, paymentReference });
    const validation = await validateIpsTextWithNbs(ips);
    payload.note += validation.checked ? (validation.valid ? ' NBS IPS QR tehnički proveren.' : ` NBS validator prijavio: ${(validation.errors || []).join('; ').slice(0, 250)}`) : ' NBS validator trenutno nije bio dostupan; QR je generisan po objavljenoj NBS specifikaciji.';
  } catch (e: any) {
    payload.note += ` IPS QR upozorenje: ${String(e?.message || e).slice(0, 250)}`;
  }

  const { data: invoice, error } = await opts.admin.from('billing_invoices').insert(payload).select('*').single();
  if (error) {
    // Paralelni cron poziv moze udariti u unique cycle index; u tom slucaju vratiti vec kreirani dokument.
    if (cycleOn && String(error.code||'')==='23505') {
      const {data:existing} = await opts.admin.from('billing_invoices').select('*')
        .eq('organization_id', opts.organization.id).eq('document_type','proforma').eq('billing_cycle_on',cycleOn).limit(1).maybeSingle();
      if (existing) return {invoice:existing,email:null,reused:true};
    }
    throw error;
  }

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

async function updateRecurringScheduleAfterPayment(admin:any, invoice:any, paidAt:string) {
  if (!invoice?.organization_id) return;
  const {data:sub} = await admin.from('subscriptions').select('first_paid_at,billing_anchor_day,next_proforma_at,auto_proforma_enabled,activated_at,last_payment_at').eq('organization_id',invoice.organization_id).maybeSingle();
  if (!sub) return;
  const firstPaidAt = sub.first_paid_at || paidAt;
  const anchorDay = Number(sub.billing_anchor_day || new Date(firstPaidAt).getUTCDate() || 1);
  const computedNext = nextMonthlyOccurrence(anchorDay, paidAt);
  const existingNext = sub.next_proforma_at ? String(sub.next_proforma_at).slice(0,10) : null;
  const nextProformaAt = existingNext && existingNext > computedNext ? existingNext : computedNext;
  const payload:any = {
    first_paid_at:firstPaidAt,
    billing_anchor_day:anchorDay,
    next_proforma_at:nextProformaAt
  };
  // Ako MASTER nije eksplicitno ugasio automatiku, prva uplata je aktivira.
  if (sub.auto_proforma_enabled !== false) payload.auto_proforma_enabled = true;
  await admin.from('subscriptions').update(payload).eq('organization_id',invoice.organization_id);
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
  const paidAt = opts.paidAt || new Date().toISOString();
  const { data, error } = await opts.admin.rpc('settle_bank_proforma', {
    p_proforma: opts.proformaId,
    p_bank_transaction: opts.bankTransactionId || null,
    p_verified_by: opts.verifiedBy || null,
    p_source: opts.verificationSource || (opts.bankTransactionId ? 'BANK_API' : 'MASTER_RUCNA_VERIFIKACIJA'),
    p_paid_at: paidAt
  });
  if (error || !data?.invoice) {
    throw new Error(error?.message || 'Rasknjižavanje nije uspelo. Pokrenite SQL 023.');
  }

  const invoice = data.invoice;
  const alreadySettled = Boolean(data.alreadySettled);
  if (!alreadySettled) {
    await updateRecurringScheduleAfterPayment(opts.admin, invoice, paidAt).catch((e:any)=>console.error('[FiscalBox billing] recurring schedule update failed',e?.message||e));
  }

  let email: any = null;
  if (invoice.recipient_email && (!alreadySettled || !invoice.emailed_at)) {
    email = await sendBillingInvoiceEmail({
      to: invoice.recipient_email,
      organizationName: invoice.recipient_name,
      invoiceNumber: invoice.invoice_number,
      plan: invoice.plan,
      totalAmount: Number(invoice.total_amount || 0),
      billingUrl: opts.appBillingUrl || '',
      pdf: buildBillingPdf(invoice),
      documentType: 'invoice'
    });
    if (email?.sent) {
      await opts.admin.from('billing_invoices').update({ emailed_at: new Date().toISOString() }).eq('id', invoice.id);
      invoice.emailed_at = new Date().toISOString();
    }
  }
  return { invoice, email, alreadySettled };
}
