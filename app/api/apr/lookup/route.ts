import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function keyify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function flatten(input: unknown, out: Array<[string, unknown]> = []) {
  if (!input || typeof input !== "object") return out;
  if (Array.isArray(input)) {
    input.forEach((item) => flatten(item, out));
    return out;
  }
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    out.push([keyify(key), value]);
    if (value && typeof value === "object") flatten(value, out);
  }
  return out;
}

function scalar(entries: Array<[string, unknown]>, aliases: string[]) {
  const normalized = aliases.map(keyify);
  for (const alias of normalized) {
    const exact = entries.find(([k, v]) => k === alias && ["string", "number", "boolean"].includes(typeof v));
    if (exact) return String(exact[1] ?? "").trim();
  }
  return "";
}

function normalizeApr(raw: unknown) {
  const entries = flatten(raw);
  return {
    name: scalar(entries, ["poslovno ime", "poslovnoime", "business name", "businessname", "naziv", "companyname", "name"]),
    pib: scalar(entries, ["pib", "poreski identifikacioni broj", "taxid", "taxpayerid", "tin"]),
    registration_number: scalar(entries, ["maticni broj", "maticnibroj", "registration number", "registrationnumber", "mb"]),
    legal_form: scalar(entries, ["pravna forma", "pravnaforma", "legal form", "legalform", "organizacioni oblik"]),
    address: scalar(entries, ["adresa sedista", "adresa", "sediste", "headquarters address", "address", "registeredaddress"]),
    municipality: scalar(entries, ["opstina", "opština", "municipality", "grad", "city"]),
    activity_code: scalar(entries, ["sifra pretezne delatnosti", "šifra pretežne delatnosti", "sifra delatnosti", "activity code", "activitycode", "industrycode"]),
    activity_name: scalar(entries, ["naziv pretezne delatnosti", "naziv pretežne delatnosti", "delatnost", "activity name", "activityname", "industryname"]),
    raw
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const { query } = await request.json();
  const digits = String(query || "").replace(/\D/g, "");
  if (![8, 9].includes(digits.length)) {
    return NextResponse.json({ error: "Unesite PIB od 9 ili matični broj od 8 cifara." }, { status: 400 });
  }

  const base = process.env.APR_API_URL;
  if (!base) {
    return NextResponse.json({
      error: "APR API još nije konfigurisan. Dodajte APR_API_URL i pristupne podatke u Vercel Environment Variables.",
      configured: false
    }, { status: 503 });
  }

  const kind = digits.length === 9 ? "pib" : "mb";
  let target = base
    .replaceAll("{query}", encodeURIComponent(digits))
    .replaceAll("{{query}}", encodeURIComponent(digits))
    .replaceAll("{pib}", kind === "pib" ? encodeURIComponent(digits) : "")
    .replaceAll("{mb}", kind === "mb" ? encodeURIComponent(digits) : "");

  if (target === base) {
    const u = new URL(base);
    u.searchParams.set(kind, digits);
    target = u.toString();
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  const token = process.env.APR_API_TOKEN;
  if (token) {
    const header = process.env.APR_API_TOKEN_HEADER || "Authorization";
    const prefix = process.env.APR_API_TOKEN_PREFIX ?? "Bearer ";
    headers[header] = `${prefix}${token}`;
  }

  try {
    const response = await fetch(target, { headers, cache: "no-store" });
    const text = await response.text();
    if (!response.ok) {
      return NextResponse.json({ error: `APR servis je vratio HTTP ${response.status}.` }, { status: 502 });
    }
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { return NextResponse.json({ error: "APR servis nije vratio JSON odgovor." }, { status: 502 }); }
    const company = normalizeApr(raw);
    if (!company.name && !company.pib && !company.registration_number) {
      return NextResponse.json({ error: "APR odgovor je primljen, ali podaci o subjektu nisu prepoznati. Potrebno je prilagoditi mapiranje APR ugovorenom formatu." }, { status: 422 });
    }
    return NextResponse.json({ company, query: digits, kind, configured: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "APR servis trenutno nije dostupan." }, { status: 502 });
  }
}
