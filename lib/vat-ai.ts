import { normalizePib, normalizeVerification } from "@/lib/fiscal";

export type VatAiRecommendation = "da" | "ne" | "provera";

export type VatAiAnalysis = {
  recommendation: VatAiRecommendation;
  confidence: number;
  reason: string;
  basis: {
    activityCode?: string | null;
    activityName?: string | null;
    matchedTerms: string[];
    riskTerms: string[];
    receiptTerms: string[];
    buyerPib?: string | null;
    organizationPib?: string | null;
    verified?: boolean | null;
  };
};

const STOP = new Set([
  "i","u","na","za","od","do","sa","se","je","su","a","ili","po","iz","uz","kod","kao","drugi","ostalo","usluge","usluga","delatnost","delatnosti","trgovina","prodaja","doo","ad","pr","preduzetnik","firma","privredno","drustvo","društvo"
]);

const RISK_TERMS = [
  "restoran","ugostitelj","hrana","pice","piće","reprezentacija","poklon","hotel","smestaj","smeštaj","nocenje","noćenje",
  "putnicki automobil","putnički automobil","automobil","gorivo","benzin","dizel","alkohol","cigarete","duvan","odeca","odeća","obuca","obuća",
  "kozmetika","parfem","namirnice","market","supermarket"
];

const ACTIVITY_KEYWORDS: Array<{test:(code:string,name:string)=>boolean; terms:string[]}> = [
  {test:(c,n)=>/^62|^63/.test(c)||/program|racunar|računar|informacion|softver|it\b|hosting|obrada podataka|portal/.test(n),terms:["racunar","računar","laptop","notebook","monitor","server","softver","software","licenca","hosting","cloud","mreza","mreža","router","ruter","switch","internet","domen","domain","ssl","backup","storage","disk","ssd","hdd","ups","kabl","toner","stampac","štampač","it oprema","cyber","sajber","antivirus","firewall","edr","siem","soc"]},
  {test:(c,n)=>/^69/.test(c)||/racunovod|računovod|knjigovod|reviz|poresk/.test(n),terms:["knjigovod","racunovod","računovod","faktura","papir","toner","stampac","štampač","softver","licenca","kancelar","office","arhiva","skener","internet","telefon","pretplata"]},
  {test:(c,n)=>/^41|^42|^43/.test(c)||/gradjev|građev|instalacij|zavrsni radovi|završni radovi/.test(n),terms:["cement","beton","gips","boja","alat","busilica","bušilica","sraf","šraf","kabl","cev","cijev","plocice","pločice","izolacija","gradjev","građev","materijal","armatura"]},
  {test:(c,n)=>/^45/.test(c)||/vozil|automobil/.test(n),terms:["auto deo","autodel","guma","ulje","filter","servis","akumulator","vozilo","alat","dijagnostika"]},
  {test:(c,n)=>/^46|^47/.test(c)||/trgovina/.test(n),terms:["roba","ambalaza","ambalaža","etiketa","kesa","pakovanje","transport","magacin","polica","barcode","skener","vaga","pos","kasa"]},
  {test:(c,n)=>/^49|^52|^53/.test(c)||/prevoz|transport|skladist|skladišt|kurir|posta|pošta/.test(n),terms:["gorivo","dizel","putarina","guma","servis","vozilo","paleta","skladiste","skladište","transport","logistika","pakovanje"]},
  {test:(c,n)=>/^55|^56/.test(c)||/hotel|smestaj|smeštaj|ugostitelj|restoran/.test(n),terms:["hrana","pice","piće","kuhinja","restoran","stolnjak","posudje","posuđe","hotel","smestaj","smeštaj","ciscenje","čišćenje","posteljina"]},
  {test:(c,n)=>/^85/.test(c)||/obrazov|skol|škol|nastav/.test(n),terms:["knjiga","udzbenik","udžbenik","papir","stampac","štampač","toner","projektor","racunar","računar","tabla","nastava","softver"]},
  {test:(c,n)=>/^86|^87|^88/.test(c)||/zdrav|medicin|stomatol/.test(n),terms:["medicin","lek","lijek","rukavice","maska","dezinfek","ordinacija","laborator","stomatol","zavoj","oprema"]}
];

function norm(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g,"dj").replace(/[^a-z0-9čćžšđ]+/gi," ")
    .replace(/\s+/g," ").trim();
}

function tokens(value: unknown) {
  return Array.from(new Set(norm(value).split(" ").filter(x=>x.length>=3&&!STOP.has(x))));
}

function collectText(raw: unknown, depth=0, out:string[]=[]): string[] {
  if(depth>6||out.join(" ").length>12000||raw==null)return out;
  if(typeof raw==="string"||typeof raw==="number"){
    const s=String(raw).trim();if(s)out.push(s);return out;
  }
  if(Array.isArray(raw)){for(const v of raw.slice(0,100))collectText(v,depth+1,out);return out;}
  if(typeof raw==="object"){
    for(const [k,v] of Object.entries(raw as Record<string,unknown>)){
      if(/name|description|item|product|journal|category|merchant|business|title|article|service/i.test(k))collectText(v,depth+1,out);
      else if(depth<2)collectText(v,depth+1,out);
    }
  }
  return out;
}

function containsTerm(haystack:string, term:string){return haystack.includes(norm(term));}

export function analyzeVatDeductibility(receipt:any, organization:any):VatAiAnalysis {
  const normalized=normalizeVerification(receipt?.raw_json||{});
  const totalTax=Number(normalized.total_tax ?? receipt?.total_tax ?? 0);
  const orgPib=normalizePib(organization?.pib);
  const buyerPib=normalizePib(normalized.buyer_pib||receipt?.buyer_pib);
  const verified=receipt?.verification_status==="provereno" && normalized.verification_valid!==false;
  const activityCode=String(organization?.activity_code||"").trim();
  const activityName=String(organization?.activity_name||"").trim();
  const rawParts=collectText(receipt?.raw_json||{});
  const receiptText=norm([
    receipt?.merchant_name,receipt?.category,receipt?.note,normalized.merchant_name,
    ...rawParts
  ].filter(Boolean).join(" "));
  const receiptTerms=tokens(receiptText).slice(0,80);
  const activityTerms=tokens(activityName);
  const matched=new Set<string>();
  const risks=new Set<string>();

  if(receipt?.bookkeeping_eligible===false || !buyerPib){
    return {recommendation:"ne",confidence:100,reason:"Na fiskalnom računu nije evidentiran ID/PIB kupca. FiscalBox ga zato ne smatra podobnim za automatsku knjigovodstvenu ili PDV obradu; može ostati sačuvan samo uz upozorenje i ručnu proveru.",basis:{activityCode,activityName,matchedTerms:[],riskTerms:[],receiptTerms:receiptTerms.slice(0,20),buyerPib,organizationPib:orgPib,verified}};
  }

  if(totalTax<=0){
    return {recommendation:"ne",confidence:100,reason:"Na računu nije evidentiran iznos PDV-a za odbitak.",basis:{activityCode,activityName,matchedTerms:[],riskTerms:[],receiptTerms:receiptTerms.slice(0,20),buyerPib,organizationPib:orgPib,verified}};
  }

  for(const t of activityTerms){if(receiptText.includes(t))matched.add(t);}
  for(const group of ACTIVITY_KEYWORDS){
    if(group.test(norm(activityCode),norm(activityName))){
      for(const term of group.terms)if(containsTerm(receiptText,term))matched.add(term);
    }
  }
  for(const term of RISK_TERMS)if(containsTerm(receiptText,term))risks.add(term);

  const warnings:string[]=[];
  if(orgPib && buyerPib && orgPib!==buyerPib)warnings.push("PIB kupca na računu se ne poklapa sa PIB-om klijenta");
  if(orgPib && !buyerPib)warnings.push("na računu nije prepoznat PIB kupca");
  if(!verified)warnings.push("verifikacija fiskalnog računa nije potvrđena");

  if(warnings.length){
    return {recommendation:"provera",confidence:88,reason:`Potrebna je ručna provera: ${warnings.join("; ")}. AI predlog ne može zameniti odluku knjigovođe.`,basis:{activityCode,activityName,matchedTerms:[...matched].slice(0,12),riskTerms:[...risks].slice(0,12),receiptTerms:receiptTerms.slice(0,20),buyerPib,organizationPib:orgPib,verified}};
  }

  if(risks.size){
    const matchText=matched.size?` Prepoznata poslovna veza: ${[...matched].slice(0,4).join(", ")}.`:"";
    return {recommendation:"provera",confidence:78,reason:`Račun sadrži stavke koje često zahtevaju dodatnu poresku proveru (${[...risks].slice(0,4).join(", ")}).${matchText} Konačnu odluku donosi knjigovođa.`,basis:{activityCode,activityName,matchedTerms:[...matched].slice(0,12),riskTerms:[...risks].slice(0,12),receiptTerms:receiptTerms.slice(0,20),buyerPib,organizationPib:orgPib,verified}};
  }

  if(matched.size>=2){
    return {recommendation:"da",confidence:88,reason:`AI je pronašao jasnu vezu između kupljene robe/usluge i registrovane delatnosti firme (${[...matched].slice(0,5).join(", ")}). Predlog je DA, uz obaveznu potvrdu knjigovođe.`,basis:{activityCode,activityName,matchedTerms:[...matched].slice(0,12),riskTerms:[],receiptTerms:receiptTerms.slice(0,20),buyerPib,organizationPib:orgPib,verified}};
  }
  if(matched.size===1){
    return {recommendation:"da",confidence:67,reason:`AI je pronašao moguću poslovnu vezu sa delatnošću firme (${[...matched][0]}), ali sa srednjom sigurnošću. Knjigovođa donosi konačnu odluku.`,basis:{activityCode,activityName,matchedTerms:[...matched],riskTerms:[],receiptTerms:receiptTerms.slice(0,20),buyerPib,organizationPib:orgPib,verified}};
  }

  return {recommendation:"ne",confidence:60,reason:"AI nije pronašao dovoljno jasnu vezu između stavki računa i registrovane delatnosti firme. Predlog je NE, ali knjigovođa može promeniti odluku ako postoji dokumentovan poslovni razlog.",basis:{activityCode,activityName,matchedTerms:[],riskTerms:[],receiptTerms:receiptTerms.slice(0,20),buyerPib,organizationPib:orgPib,verified}};
}

export async function ensureVatAiAnalysis(admin:any, receipt:any, organization:any){
  if(receipt?.ai_vat_recommendation && receipt?.ai_vat_analyzed_at){
    return {
      recommendation:receipt.ai_vat_recommendation as VatAiRecommendation,
      confidence:Number(receipt.ai_vat_confidence||0),
      reason:String(receipt.ai_vat_reason||""),
      basis:receipt.ai_vat_basis||{}
    } as VatAiAnalysis;
  }
  const analysis=analyzeVatDeductibility(receipt,organization);
  const patch={
    ai_vat_recommendation:analysis.recommendation,
    ai_vat_confidence:analysis.confidence,
    ai_vat_reason:analysis.reason,
    ai_vat_basis:analysis.basis,
    ai_vat_analyzed_at:new Date().toISOString()
  };
  await admin.from("receipts").update(patch).eq("id",receipt.id);
  Object.assign(receipt,patch);
  return analysis;
}
