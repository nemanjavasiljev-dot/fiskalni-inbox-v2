import { isValidPib, normalizePib } from '@/lib/company-identifiers';
import { parsePublicNbsResults } from '@/lib/nbs-public-parser';
export type { PublicNbsCompany as NbsCompanyMatch } from '@/lib/nbs-public-parser';

export const NBS_SEARCH_BASE = 'https://webappcenter.nbs.rs/PnWebApp/CompanyAccount/CompanyAccountResident';
export async function resolvePibViaNbs(input: string) {
  const pib = normalizePib(input);
  if (!isValidPib(pib)) throw new Error('PIB nije ispravan.');
  const url = new URL(NBS_SEARCH_BASE);
  url.searchParams.set('CompanyTaxCode', pib);
  url.searchParams.set('TypeID', '1');
  url.searchParams.set('isSearchExecuted', 'true');
  url.searchParams.set('Pagging.CurrentPage', '1');
  url.searchParams.set('Pagging.PageSize', '20');
  const response = await fetch(url, {
    headers: {Accept:'text/html', 'User-Agent':'FiscalBox/5.9 company lookup'},
    cache:'no-store', redirect:'error', signal:AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`NBS javna pretraga trenutno nije dostupna (HTTP ${response.status}).`);
  const html = await response.text();
  if (html.length > 2_000_000) throw new Error('NBS odgovor je prevelik.');
  return parsePublicNbsResults(html, pib);
}
// Legacy callers: only exact PIB queries are supported by this public adapter.
export async function searchCompaniesViaNbs(query: string) {
  return isValidPib(query) ? resolvePibViaNbs(query) : [];
}
