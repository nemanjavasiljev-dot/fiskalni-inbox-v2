import { digitsOnly, normalizeCompanyName } from '@/lib/company-registry';

export type NbsCompanyMatch = {
  name: string;
  registration_number: string;
  pib: string | null;
  address: string | null;
  city: string | null;
  municipality: string | null;
  activity_name: string | null;
};

const NBS_SEARCH_BASE = 'https://webappcenter.nbs.rs/PnWebApp/CompanyAccount/CompanyAccountResident';

function decodeHtml(value:string){
  return value
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&lt;/gi,'<')
    .replace(/&gt;/gi,'>')
    .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCharCode(parseInt(n,16)));
}
function cleanCell(html:string){
  return decodeHtml(html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
}
function parseRows(html:string):NbsCompanyMatch[]{
  const out:NbsCompanyMatch[]=[];
  const seen=new Set<string>();
  const rows=html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)||[];
  for(const row of rows){
    const cells=[...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>cleanCell(m[1]));
    // NBS resident-account search columns begin with:
    // name, MB, PIB, address, city, municipality, activity, bank, ...
    if(cells.length<4)continue;
    const rawMb=digitsOnly(cells[1]);
    const tax=digitsOnly(cells[2]);
    if(rawMb.length<4||rawMb.length>13)continue;
    const registration=rawMb.padStart(8,'0').slice(-8);
    const key=`${registration}:${tax}`;
    if(seen.has(key))continue;seen.add(key);
    out.push({
      name:cells[0]||`NBS subjekt ${registration}`,
      registration_number:registration,
      pib:tax.length===9?tax:null,
      address:cells[3]||null,
      city:cells[4]||null,
      municipality:cells[5]||null,
      activity_name:cells[6]||null,
    });
  }
  return out;
}

export async function searchCompaniesViaNbs(queryInput:string){
  const query=String(queryInput||'').trim();
  const numeric=digitsOnly(query);
  if(!query || (numeric.length===0 && query.length<3))return [] as NbsCompanyMatch[];
  const url=new URL(NBS_SEARCH_BASE);
  const params:Record<string,string>={
    AccountNumber:'',BankCode:'',City:'',CompanyName:'',CompanyNationalCode:'',CompanyTaxCode:'',
    ControlNumber:'',OrderBy:'','Pagging.CurrentPage':'1','Pagging.PageSize':'20',TypeID:'1',isSearchExecuted:'true'
  };
  if(numeric.length===9)params.CompanyTaxCode=numeric;
  else if(numeric.length===8)params.CompanyNationalCode=numeric;
  else params.CompanyName=query;
  for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);

  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),Number(process.env.NBS_LOOKUP_TIMEOUT_MS||12000));
  try{
    const response=await fetch(url.toString(),{headers:{Accept:'text/html,application/xhtml+xml','User-Agent':'FiscalBox/1.0 (+official NBS company resolver)'},cache:'no-store',signal:controller.signal});
    if(!response.ok)throw new Error(`NBS je vratio HTTP ${response.status}.`);
    const rows=parseRows(await response.text());
    const nq=normalizeCompanyName(query);
    const filtered=rows.filter(r=>{
      if(numeric.length===9)return r.pib===numeric;
      if(numeric.length===8)return r.registration_number===numeric;
      return normalizeCompanyName(r.name).includes(nq);
    });
    return filtered.slice(0,15);
  } finally { clearTimeout(timer); }
}

export async function resolvePibViaNbs(pib:string){ return searchCompaniesViaNbs(pib); }
