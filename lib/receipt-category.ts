export const RECEIPT_CATEGORIES = [
  "Gorivo",
  "Reprezentacija",
  "Putarina",
  "Parking",
  "Smeštaj",
  "Putovanje",
  "Kancelarijski materijal",
  "IT oprema",
  "Telekomunikacije",
  "Komunalije",
  "Održavanje i servis",
  "Marketing",
  "Hrana i piće",
  "Ostalo"
] as const;

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function collectStrings(input: unknown, out: string[] = [], depth = 0): string[] {
  if (depth > 8 || input == null) return out;
  if (typeof input === "string" || typeof input === "number") {
    const text = normalizeText(input).trim();
    if (text) out.push(text);
    return out;
  }
  if (Array.isArray(input)) {
    input.forEach(item => collectStrings(item, out, depth + 1));
    return out;
  }
  if (typeof input === "object") {
    Object.entries(input as Record<string, unknown>).forEach(([key, value]) => {
      const k = normalizeText(key);
      // Prefer fields that frequently contain item/merchant descriptions, but still
      // inspect nested values because TaxCore response shapes can differ.
      if (/name|item|product|article|description|merchant|business|seller|label|text/.test(k)) {
        collectStrings(value, out, depth + 1);
      } else if (typeof value === "object") {
        collectStrings(value, out, depth + 1);
      }
    });
  }
  return out;
}

const RULES: Array<{ category: string; keywords: string[] }> = [
  { category: "Gorivo", keywords: ["benzin","dizel","evrodizel","gas oil","gorivo","lpg","tng","adblue","nis petrol","mol","omv","lukoil","gazprom"] },
  { category: "Putarina", keywords: ["putarina","toll","putevi srbije","naplatna stanica","tag uredjaj","enp"] },
  { category: "Parking", keywords: ["parking","parkiranje","parking servis","garaza","garaza"] },
  { category: "Smeštaj", keywords: ["hotel","motel","apartman","smestaj","nocenje","booking","hostel"] },
  { category: "Putovanje", keywords: ["avio","air serbia","airline","autobus","bus ticket","voz","zeleznice","rent a car","renta car","taxi","transfer"] },
  { category: "IT oprema", keywords: ["laptop","notebook","racunar","kompjuter","monitor","ssd","hdd","ram","procesor","graficka","mis","tastatura","router","switch","server","gigatron","tehnomanija","winwin"] },
  { category: "Telekomunikacije", keywords: ["telekom","mts","yettel","a1 srbija","internet","telefonija","mobilni paket","optika"] },
  { category: "Kancelarijski materijal", keywords: ["papir a4","registrator","fascikla","toner","kertridz","hemijska","olovka","spajalice","stampa","kancelarijski"] },
  { category: "Komunalije", keywords: ["elektroprivreda","eps","struja","vodovod","voda","gas","toplana","komunalno","odnosenje otpada"] },
  { category: "Održavanje i servis", keywords: ["servis","popravka","odrzavanje","rezervni deo","rezervni delovi","vulkanizer","autodelovi","pranje vozila"] },
  { category: "Marketing", keywords: ["oglasavanje","marketing","reklama","facebook ads","google ads","meta ads","bilbord","baner","promo materijal"] },
  { category: "Reprezentacija", keywords: ["restoran","kafana","caffe","cafe","kafic","catering","rucak","vecera","reprezentacija"] },
  { category: "Hrana i piće", keywords: ["market","supermarket","maxi","idea","univerexport","lidl","dis","hrana","pice","voda 0","sok","kafa","pekara"] }
];

export function classifyReceiptCategory(raw: unknown, merchantName?: string | null) {
  const strings = collectStrings(raw);
  if (merchantName) strings.unshift(normalizeText(merchantName));
  const haystack = ` ${strings.join(" | ")} `;

  let best = { category: "Ostalo", score: 0, matches: [] as string[] };
  for (const rule of RULES) {
    const matches = rule.keywords.filter(k => haystack.includes(normalizeText(k)));
    if (!matches.length) continue;
    // Multiple matching item names increase confidence.
    const score = matches.reduce((sum, k) => sum + Math.max(1, Math.min(4, normalizeText(k).length / 5)), 0);
    if (score > best.score) best = { category: rule.category, score, matches };
  }

  const confidence = best.score === 0 ? 0.2 : Math.min(0.96, 0.55 + best.score * 0.07);
  return { category: best.category, confidence, matches: best.matches, source: "smart_classifier" };
}
