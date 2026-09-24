export type PublicNbsCompany = {
  name: string; registration_number: string; pib: string;
  address: string | null; city: string | null;
  municipality: string | null; activity_name: string | null;
};
function clean(html: string) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ').trim();
}
// Fail closed on layout changes; never infer an identity from arbitrary digit cells.
export function parsePublicNbsResults(html: string, requestedPib: string): PublicNbsCompany[] {
  const found: PublicNbsCompany[] = [];
  let recognized = false;
  for (const table of html.match(/<table\b[^>]*>[\s\S]*?<\/table>/gi) || []) {
    const rows = table.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];
    let columns: string[] = [];
    for (const row of rows) {
      if (/<th\b/i.test(row)) {
        columns = [...row.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(m => clean(m[1]).toLowerCase());
        continue;
      }
      const index = (rx: RegExp) => columns.findIndex(c => rx.test(c));
      const tax = index(/порески|pore[sš]ki|\bpib\b|пиб/);
      const mb = index(/матични|mati[cč]ni/);
      const name = index(/назив|пословно име|naziv|poslovno ime/);
      if (tax < 0 || mb < 0 || name < 0) continue;
      recognized = true;
      const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m => clean(m[1]));
      if (cells[tax]?.replace(/\s/g, '') !== requestedPib) continue;
      const registration = (cells[mb] || '').replace(/\s/g, '');
      if (!/^\d{4,13}$/.test(registration) || !cells[name]) continue;
      const field = (rx: RegExp) => cells[index(rx)] || null;
      const record = {
        name: cells[name], registration_number: registration.length < 8 ? registration.padStart(8, '0') : registration,
        pib: requestedPib, address: field(/адреса|adresa/), city: field(/^место$|^mesto$/),
        municipality: field(/општина|op[sš]tina/), activity_name: field(/делатност|delatnost/),
      };
      if (!found.some(c => c.registration_number === record.registration_number)) found.push(record);
    }
  }
  if (found.length > 1) throw new Error('NBS je vratio više različitih subjekata za isti PIB.');
  if (!recognized && !/нема података|нема резултата|нису пронађени|не постоји.*(?:рачун|подат)|nema podataka|nema rezultata|no records/i.test(clean(html))) {
    throw new Error('Format NBS odgovora nije prepoznat. Koristite ručnu proveru registra.');
  }
  return found;
}
