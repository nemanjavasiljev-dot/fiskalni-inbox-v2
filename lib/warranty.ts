function norm(v: unknown) {
  return String(v ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function collect(input: unknown, out: string[] = [], depth = 0): string[] {
  if (depth > 8 || input == null) return out;
  if (typeof input === "string" || typeof input === "number") {
    const t = norm(input).trim(); if (t) out.push(t); return out;
  }
  if (Array.isArray(input)) { input.forEach(v => collect(v, out, depth + 1)); return out; }
  if (typeof input === "object") {
    Object.entries(input as Record<string, unknown>).forEach(([k,v]) => {
      const key = norm(k);
      if (/name|item|product|article|description|merchant|business|seller|text|journal/.test(key)) collect(v,out,depth+1);
      else if (v && typeof v === "object") collect(v,out,depth+1);
    });
  }
  return out;
}

const WARRANTY_KEYWORDS = [
  "laptop","notebook","racunar","kompjuter","monitor","telefon","smartphone","tablet","televizor","tv ",
  "stampac","printer","skener","router","switch","server","ups","ssd","hdd","disk","memorija","ram",
  "tastatura","mis ","mouse","slusalice","headset","kamera","fotoaparat","objektiv","projektor",
  "frizider","zamrzivac","ves masina","masina za sudove","sporet","rerna","mikrotalasna","klima","bojler",
  "usisivac","alat","busilica","brusilica","kosilica","motorna testera","pumpa","agregat","inverter",
  "guma ","pneumatik","akumulator","felna","rezervni deo","uredjaj","oprema","gigatron","tehnomanija","bc group","winwin"
];

const NON_WARRANTY = ["gorivo","benzin","dizel","hrana","pice","restoran","parking","putarina","hotel","nocenje","usluga interneta","pretplata"];

export function detectWarrantyCandidate(raw: unknown, merchantName?: string | null, category?: string | null) {
  const hay = ` ${[merchantName, category, ...collect(raw)].map(norm).join(" | ")} `;
  if (NON_WARRANTY.some(k => hay.includes(norm(k)))) return {candidate:false,confidence:0.2,reason:"Potrošna roba ili usluga bez tipične robne garancije."};
  const matches = WARRANTY_KEYWORDS.filter(k => hay.includes(norm(k)));
  const categoryHit = norm(category).includes("it oprema") || norm(category).includes("odrzavanje i servis");
  const candidate = matches.length > 0 || categoryHit;
  return {
    candidate,
    confidence: candidate ? Math.min(0.95, 0.62 + matches.length * 0.07) : 0.25,
    reason: candidate ? `Prepoznata roba koja tipično ima garanciju${matches.length?`: ${matches.slice(0,4).join(", ")}`:"."}` : "Nije prepoznata roba sa tipičnom garancijom."
  };
}
