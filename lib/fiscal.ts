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

function normalizedKey(value:string){
  return value.toLocaleLowerCase("sr").replace(/[\s_\-]/g,"");
}

function taxFromJournal(value:unknown){
  const text=String(value??"").replace(/&nbsp;|&#160;/gi," ").replace(/<[^>]+>/g," ").replace(/\u00a0/g," ");
  if(!text.trim())return null;
  const totalPatterns=[
    /(?:Ukupan\s+iznos\s+poreza|Ukupan\s+porez|Total\s+tax|Total\s+VAT)\s*[:：]?\s*([+-]?\d[\d\s.]*(?:,\d{1,2})?)/i,
    /(?:Укупан\s+износ\s+пореза|Укупан\s+порез)\s*[:：]?\s*([+-]?\d[\d\s.]*(?:,\d{1,2})?)/i,
  ];
  for(const pattern of totalPatterns){
    const hit=text.match(pattern);
    const parsed=hit?num(hit[1]):null;
    if(parsed!=null)return parsed;
  }

  // Rezervni slučaj: saberi kolonu „Porez“ u specifikaciji poreskih stopa.
  const lines=text.split(/\r?\n/);
  let taxSection=false;
  let sum=0;
  let found=0;
  for(const rawLine of lines){
    const line=rawLine.replace(/\u00a0/g," ").trim();
    if(!line)continue;
    if(/(?:Oznaka|Ознака).*?(?:Stopa|Стопа).*?(?:Porez|Порез)/i.test(line)){taxSection=true;continue;}
    if(!taxSection)continue;
    if(/(?:PFR\s*vreme|ПФР\s*време|PFR\s*broj|ПФР\s*број|KRAJ\s+FISKALNOG|КРАЈ\s+ФИСКАЛНОГ)/i.test(line))break;
    const match=line.match(/\d{1,3}(?:[.,]\d{1,2})?\s*%[^\d+-]*([+-]?\d[\d\s.]*(?:,\d{1,2})?)/);
    if(!match)continue;
    const parsed=num(match[1]);
    if(parsed!=null){sum+=parsed;found++;}
  }
  return found?Number(sum.toFixed(2)):null;
}

function taxFromSummaryArrays(input:unknown){
  let result:number|null=null;
  const visit=(node:any,key="")=>{
    if(result!=null||node==null)return;
    if(Array.isArray(node)){
      const nk=normalizedKey(key);
      if(["taxitems","taxsummary","taxsummaries","taxes","vatsummary","vattotals"].includes(nk)){
        let sum=0,found=0;
        for(const item of node){
          if(!item||typeof item!=="object")continue;
          const entries=Object.entries(item as Record<string,unknown>);
          const amountEntry=entries.find(([k])=>["taxamount","vatamount","tax","vat"].includes(normalizedKey(k)));
          if(!amountEntry)continue;
          const parsed=num(amountEntry[1]);
          if(parsed!=null){sum+=parsed;found++;}
        }
        if(found){result=Number(sum.toFixed(2));return;}
      }
      for(const item of node)visit(item,key);
      return;
    }
    if(typeof node==="object")for(const [k,v] of Object.entries(node))visit(v,k);
  };
  visit(input);
  return result;
}

/**
 * Vraća ukupan PDV sa fiskalnog računa. Zvanični verification JSON često
 * nema posebno totalTax polje, ali sadrži journal u kome fiskalni račun
 * obavezno iskazuje „Ukupan iznos poreza“.
 */
export function extractTotalTax(raw:unknown){
  if(!raw||typeof raw!=="object")return taxFromJournal(raw);
  const entries=allEntries(raw);
  const directKeys=new Set([
    "totaltax","totaltaxamount","totalvat","totalvatamount",
    "ukupaniznosporeza","ukupanporez","ukupanpdv"
  ]);
  for(const [k,v] of entries){
    if(!directKeys.has(normalizedKey(k)))continue;
    const parsed=num(v);
    if(parsed!=null)return parsed;
  }
  const journal=pickScalar(entries,["journal","invoicejournal"]);
  const fromJournal=taxFromJournal(journal);
  if(fromJournal!=null)return fromJournal;
  const fromArrays=taxFromSummaryArrays(raw);
  if(fromArrays!=null)return fromArrays;
  // HTML fallback sa verification stranice ponekad završi kao tekst u raw_json.
  for(const [,v] of entries){
    if(typeof v!=="string")continue;
    const parsed=taxFromJournal(v);
    if(parsed!=null)return parsed;
  }
  return null;
}

export function receiptTotalTax(receipt:any){
  const extracted=extractTotalTax(receipt?.raw_json);
  if(extracted!=null)return extracted;
  const stored=num(receipt?.total_tax);
  return stored;
}

export function normalizePib(v: unknown) {
  const raw = String(v ?? "").trim();
  if (!raw) return null;
  const labeled = raw.match(/(?:^|\D)(\d{9})(?:\D|$)/);
  if (labeled) return labeled[1];
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 9) return digits;
  // eFiskalizacija BuyerId ponekad stigne sabijen kao 10 + PIB bez separatora.
  if (digits.length === 11 && digits.startsWith("10")) return digits.slice(2);
  return null;
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

function buyerPibFromText(value: unknown) {
  const text = String(value ?? "");
  if (!text.trim()) return null;
  const patterns = [
    /(?:ID\s*kupca|ИД\s*купца|Buyer\s*ID|BuyerId|BuyerIdentification)\s*[:：=]\s*(?:10\s*[:：\-\s]\s*)?(\d{9})(?!\d)/i,
    /(?:^|\D)10\s*[:：\-]\s*(\d{9})(?!\d)/m,
    /(?:^|\D)10(\d{9})(?!\d)/m,
  ];
  for (const re of patterns) {
    const hit = text.match(re);
    if (hit) return hit[1];
  }
  return null;
}

export function extractBuyerPib(raw: unknown) {
  const entries = allEntries(raw);
  const directKeys = new Set([
    "buyertin","buyerid","buyerpib","buyeridentification","buyeridentificationnumber",
    "buyeridentifier","customerid","customerpib","pibkupca","idkupca"
  ]);
  for (const [k,v] of entries) {
    if (!directKeys.has(k)) continue;
    const pib = normalizePib(v) || buyerPibFromText(v);
    if (pib) return pib;
  }
  for (const [,v] of entries) {
    if (typeof v !== "string" && typeof v !== "number") continue;
    const pib = buyerPibFromText(v);
    if (pib) return pib;
  }
  return null;
}

export function normalizeVerification(raw: unknown) {
  const e = allEntries(raw);
  const statusRaw = pickScalar(e,["status","verificationstatus","invoicestatus"]);
  const explicitValid=pickScalar(e,["isvalid","valid"]);
  const status = typeof explicitValid==="boolean"
    ? {text:explicitValid?"Račun je validan":"Račun nije validan",valid:explicitValid}
    : verificationStatus(statusRaw);
  const extension = String(pickScalar(e,[
    "invoiceandtransactiontypeextension","invoicecounterextension","invoiceextension"
  ]) || "") || null;
  const totalCounter = num(pickScalar(e,["totalcounter"]));
  const counterByType = num(pickScalar(e,["counterbyinvoiceandtransactiontype","transactiontypecounter"]));
  const invoiceCounter = String(pickScalar(e,["invoicecounter"]) || "") ||
    (counterByType != null && totalCounter != null ? `${counterByType}/${totalCounter}${extension || ""}` : null);

  const journal = String(pickScalar(e,["journal","invoicejournal"]) || "") || null;
  const directBuyerPib = normalizePib(pickScalar(e, [
    "buyertin", "buyerid", "buyerpib", "buyeridentification", "buyeridentificationnumber",
    "buyeridentifier", "customerid", "customerpib", "pibkupca", "idkupca"
  ]));
  const buyerPib = directBuyerPib || buyerPibFromText(journal) || extractBuyerPib(raw);

  return {
    verification_status_text: status.text,
    verification_valid: status.valid,
    merchant_name: String(pickScalar(e, [
      "businessname", "merchantname", "sellername", "companyname", "shopname", "locationname"
    ]) || "") || null,
    merchant_pib: normalizePib(pickScalar(e, [
      "tin", "taxid", "taxpayerid", "sellertin", "merchanttin", "pib"
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
    total_tax: extractTotalTax(raw),
    payment_method: paymentNames(e),
    buyer_pib: buyerPib,
    buyer_cost_center: String(pickScalar(e,["buyercostcenterid","buyercostcenter"]) || "") || null,
    requested_by: String(pickScalar(e,["requestedby"]) || "") || null,
    signed_by: String(pickScalar(e,["signedby"]) || "") || null,
    invoice_counter: invoiceCounter,
    invoice_type_extension: extension,
    total_counter: totalCounter,
    counter_by_type: counterByType,
    journal,
    reference_number: String(pickScalar(e,["referencedocumentnumber","referencenumber"]) || "") || null,
    pos_number: String(pickScalar(e,["posnumber","mrc"]) || "") || null
  };
}
