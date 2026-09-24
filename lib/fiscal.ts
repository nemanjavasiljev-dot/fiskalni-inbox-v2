const ALLOWED_HOSTS = ["suf.purs.gov.rs", "purs.gov.rs"];

export function isAllowedFiscalUrl(raw: string) {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) return false;
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

function pickArray(entries: [string, unknown][], keys: string[]) {
  for (const key of keys) {
    const hit = entries.find(([k, v]) => k === key.toLowerCase() && Array.isArray(v));
    if (hit) return hit[1] as unknown[];
  }
  return null;
}

function num(v: unknown) {
  if (v == null || String(v).trim() === '') return null;
  let value = String(v).replace(/\s/g, '');
  if (value.includes(',') && value.includes('.')) {
    value = value.lastIndexOf(',') > value.lastIndexOf('.')
      ? value.replace(/\./g, '').replace(',', '.') : value.replace(/,/g, '');
  } else value = value.replace(',', '.');
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function safeDate(v: unknown) {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function normalizePib(v: unknown) {
  const raw = String(v ?? "").trim();
  if (!raw) return null;
  const match = raw.match(/(?:^|\D)(\d{9})(?:\D|$)/);
  if (match) return match[1];
  const digits = raw.replace(/\D/g, "");
  return digits.length === 9 ? digits : raw;
}

const PAYMENT_TYPES: Record<string,string> = {
  "0":"Drugo",
  "1":"Gotovina",
  "2":"Platna kartica",
  "3":"Ček",
  "4":"Prenos na račun",
  "5":"Vaučer",
  "6":"Mobilno / instant plaćanje"
};

function paymentNames(entries: [string, unknown][]) {
  const explicit = pickScalar(entries,["paymentmethod","paymenttype","payment"]);
  if (explicit != null && String(explicit).trim()) return String(explicit).trim();
  const arr = pickArray(entries,["paymenttypes","paymenttypeids"]);
  if (!arr?.length) return null;
  return arr.map(x=>PAYMENT_TYPES[String(x)] || String(x)).join(", ");
}

export function verificationStatus(rawStatus: unknown) {
  const s = String(rawStatus ?? "").trim();
  if (!s) return { text:null, valid:null as boolean|null };
  const n = s.toLocaleLowerCase("sr");
  if (/(not.*valid|not.*verified|nije.*(?:valid|važe|isprav)|nevalid|invalid|nevaže|nevaž|neisprav|није.*(?:валид|важе|исправ)|невалид|неваже|неисправ)/i.test(n)) return {text:s,valid:false};
  if (/^(?:valid|validan|validna|validno|važeći|važeća|važeće|ispravan|ispravna|ispravno|валидно|валидан|валидна|важећи|важећа|исправан|исправна|invoice is valid|račun je validan)[.!]?$/.test(n)) return {text:s,valid:true};
  return {text:s,valid:null as boolean|null};
}

export function normalizeVerification(raw: unknown) {
  const e = allEntries(raw);
  const statusRaw = pickScalar(e,["status","verificationstatus","invoicestatus"]);
  const status = verificationStatus(statusRaw);
  const extension = String(pickScalar(e,[
    "invoiceandtransactiontypeextension","invoicecounterextension","invoiceextension"
  ]) || "") || null;
  const totalCounter = num(pickScalar(e,["totalcounter"]));
  const counterByType = num(pickScalar(e,["counterbyinvoiceandtransactiontype","transactiontypecounter"]));
  const invoiceCounter = String(pickScalar(e,["invoicecounter"]) || "") ||
    (counterByType != null && totalCounter != null ? `${counterByType}/${totalCounter}${extension || ""}` : null);

  return {
    verification_status_text: status.text,
    verification_valid: status.valid,
    merchant_name: String(pickScalar(e, [
      "businessname", "merchantname", "sellername", "companyname", "shopname", "locationname"
    ]) || "") || null,
    merchant_pib: normalizePib(pickScalar(e, [
      "tin", "taxpayerid", "sellertin", "merchanttin", "pib"
    ])),
    location_name: String(pickScalar(e,["locationname","shopname"]) || "") || null,
    address: String(pickScalar(e,["address","locationaddress"]) || "") || null,
    city: String(pickScalar(e,["city","locationcity"]) || "") || null,
    municipality: String(pickScalar(e,["administrativeunitname","municipality"]) || "") || null,
    invoice_number: String(pickScalar(e, [
      "sdcinvoicenumber", "invoicenumber", "receiptno", "receiptid"
    ]) || "") || null,
    sdc_time: safeDate(pickScalar(e, [
      "sdctime", "sdcdatetime", "sdcdateandtime", "transactiontime", "datetime", "createdat"
    ])),
    total_amount: num(pickScalar(e, [
      "totalamount", "total", "grandtotal", "amount"
    ])),
    total_tax: num(pickScalar(e, [
      "totaltax", "taxamount", "vatamount", "vat"
    ])),
    payment_method: paymentNames(e),
    buyer_pib: normalizePib(pickScalar(e, [
      "buyertin", "buyerid", "buyerpib"
    ])),
    buyer_cost_center: String(pickScalar(e,["buyercostcenterid","buyercostcenter"]) || "") || null,
    requested_by: String(pickScalar(e,["requestedby"]) || "") || null,
    signed_by: String(pickScalar(e,["signedby"]) || "") || null,
    invoice_counter: invoiceCounter,
    invoice_type_extension: extension,
    total_counter: totalCounter,
    counter_by_type: counterByType,
    journal: String(pickScalar(e,["journal","invoicejournal"]) || "") || null,
    reference_number: String(pickScalar(e,["referencedocumentnumber","referencenumber"]) || "") || null,
    pos_number: String(pickScalar(e,["posnumber","mrc"]) || "") || null
  };
}
