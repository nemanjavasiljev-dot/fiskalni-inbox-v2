const ALLOWED_HOSTS = ["suf.purs.gov.rs", "purs.gov.rs"];

export function isAllowedFiscalUrl(raw: string) {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    return ALLOWED_HOSTS.some(h => u.hostname === h || u.hostname.endsWith("." + h));
  } catch {
    return false;
  }
}

function allEntries(input: unknown, out: [string, unknown][] = []) {
  if (!input || typeof input !== "object") return out;
  if (Array.isArray(input)) {
    input.forEach(x => allEntries(x, out));
    return out;
  }
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    out.push([k.toLowerCase(), v]);
    if (v && typeof v === "object") allEntries(v, out);
  }
  return out;
}

function pickScalar(entries: [string, unknown][], keys: string[]) {
  for (const key of keys) {
    const hit = entries.find(([k, v]) =>
      k === key.toLowerCase() &&
      (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
    );
    if (hit) return hit[1];
  }
  return null;
}

function num(v: unknown) {
  if (v == null) return null;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function safeDate(v: unknown) {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function normalizeVerification(raw: unknown) {
  const e = allEntries(raw);
  return {
    merchant_name: String(pickScalar(e, [
      "businessname", "merchantname", "sellername", "companyname", "shopname"
    ]) || "") || null,
    merchant_pib: String(pickScalar(e, [
      "tin", "taxpayerid", "sellertin", "merchanttin", "pib"
    ]) || "") || null,
    invoice_number: String(pickScalar(e, [
      "sdcinvoicenumber", "invoicenumber", "receiptno", "receiptid"
    ]) || "") || null,
    sdc_time: safeDate(pickScalar(e, [
      "sdctime", "transactiontime", "datetime", "createdat"
    ])),
    total_amount: num(pickScalar(e, [
      "totalamount", "total", "grandtotal", "amount"
    ])),
    total_tax: num(pickScalar(e, [
      "totaltax", "taxamount", "vatamount", "vat"
    ])),
    payment_method: String(pickScalar(e, [
      "paymentmethod", "paymenttype", "payment"
    ]) || "") || null,
    buyer_pib: String(pickScalar(e, [
      "buyertin", "buyerid", "buyerpib"
    ]) || "") || null
  };
}
