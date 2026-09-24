import { createAdminClient } from '@/lib/supabase/admin';
import { digitsOnly, normalizeCompanyName, publicCompany, type CompanyRecord } from '@/lib/company-registry';

type AprCompany = Omit<CompanyRecord, 'id'> & { apr_raw?: unknown };
type SyncResult = { company: CompanyRecord; inserted: boolean; updated: boolean };

const DEFAULT_OPEN_DATA_URL='';
let openDataCache:{at:number;companies:AprCompany[]}|null=null;
let openDataPromise:Promise<AprCompany[]>|null=null;

function keyify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
function scalarFromObject(input: Record<string, unknown>, aliases: string[]) {
  const wanted = new Set(aliases.map(keyify));
  for (const [key, value] of Object.entries(input)) {
    if (wanted.has(keyify(key)) && ['string','number','boolean'].includes(typeof value)) return String(value ?? '').trim();
  }
  return '';
}
function objectByAlias(input:Record<string,unknown>,aliases:string[]){
  const wanted=new Set(aliases.map(keyify));
  for(const [key,value] of Object.entries(input)) if(wanted.has(keyify(key))&&value&&typeof value==='object'&&!Array.isArray(value)) return value as Record<string,unknown>;
  return null;
}
function nestedName(input:Record<string,unknown>|null){
  if(!input)return '';
  return scalarFromObject(input,['name','naziv','title','value']);
}
function parseDate(value: string) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
function normalizeCandidate(obj: Record<string, unknown>): AprCompany | null {
  const name = scalarFromObject(obj, ['poslovno ime','poslovnoime','business name','businessname','naziv','companyname','name','puno poslovno ime']);
  const registration = digitsOnly(scalarFromObject(obj, ['maticni broj','matični broj','maticnibroj','registration number','registrationnumber','registrationNumber','mb']));
  const pib = digitsOnly(scalarFromObject(obj, ['pib','poreski identifikacioni broj','taxid','taxpayerid','tin']));
  if (!name && registration.length !== 8 && pib.length !== 9) return null;

  const municipalityObj=objectByAlias(obj,['municipality','opstina','opština']);
  const addressObj=objectByAlias(obj,['headquarters','sediste','sedište','address','registeredAddress']);
  const activityObj=objectByAlias(obj,['activity','registeredActivity','pretežna delatnost','pretezna delatnost']);

  const address = scalarFromObject(obj, ['adresa sedista','adresa sedišta','adresa','sediste','sedište','headquarters address','address','registeredaddress']) || scalarFromObject(addressObj||{},['address','street','name']);
  const city = scalarFromObject(obj, ['mesto','naselje','city','place']) || scalarFromObject(addressObj||{},['city','place','settlement']);
  const municipality = scalarFromObject(obj, ['opstina','opština','municipality','grad','city municipality']) || nestedName(municipalityObj) || scalarFromObject(addressObj||{},['municipality','opstina','opština']);
  const postalCode = digitsOnly(scalarFromObject(obj, ['postanski broj','poštanski broj','postal code','postalcode','zip']) || scalarFromObject(addressObj||{},['postalCode','zip']));
  const legalForm = scalarFromObject(obj, ['pravna forma','pravnaforma','legal form','legalform','organizacioni oblik','legalForm']);
  const activityCode = scalarFromObject(obj, ['sifra pretezne delatnosti','šifra pretežne delatnosti','sifra delatnosti','šifra delatnosti','activity code','activitycode','industrycode','activityCode']) || scalarFromObject(activityObj||{},['code','sifra','šifra']);
  const activityName = scalarFromObject(obj, ['naziv pretezne delatnosti','naziv pretežne delatnosti','delatnost','activity name','activityname','industryname']) || nestedName(activityObj);
  const status = scalarFromObject(obj, ['status','status subjekta','registracioni status','registration status','registrystatus']);
  const founded = scalarFromObject(obj, ['datum osnivanja','datum registracije','founded at','foundedat','registration date','registrationdate','incorporationDate']);
  const sourceId = scalarFromObject(obj, ['apr id','aprid','source id','sourceid','id subjekta','subjectid','entityid','id']);

  return {
    name: name || `APR subjekt ${registration || pib}`,
    registration_number: registration.length === 8 ? registration : null,
    pib: pib.length === 9 ? pib : null,
    address: address || null,
    city: city || null,
    municipality: municipality || null,
    postal_code: postalCode || null,
    legal_form: legalForm || null,
    activity_code: activityCode || null,
    activity_name: activityName || null,
    registry_status: status || null,
    founded_at: parseDate(founded),
    apr_source_id: sourceId || registration || null,
    apr_last_sync: new Date().toISOString(),
    apr_raw: obj,
    source_status: 'apr',
    manual_review_required: false,
  };
}
function candidateScore(c: AprCompany) { return (c.registration_number ? 4 : 0) + (c.pib ? 3 : 0) + (c.name ? 2 : 0) + (c.registry_status ? 1 : 0); }

function rowsFromOpenDataMap(input:unknown):Record<string,unknown>[] {
  if(!input||typeof input!=='object'||Array.isArray(input))return [];
  const entries=Object.entries(input as Record<string,unknown>);
  const keyed=entries.filter(([key,value])=>/^\d{8}$/.test(key)&&value&&typeof value==='object'&&!Array.isArray(value));
  if(keyed.length<10)return [];
  return keyed.map(([registrationNumber,value])=>({registrationNumber,...(value as Record<string,unknown>)}));
}
function findLargestObjectCollection(input:unknown):Record<string,unknown>[] {
  let best:Record<string,unknown>[]=[];
  const seen=new Set<unknown>();
  function walk(v:unknown){
    if(!v||typeof v!=='object'||seen.has(v))return;seen.add(v);
    if(Array.isArray(v)){
      const objs=v.filter(x=>x&&typeof x==='object'&&!Array.isArray(x)) as Record<string,unknown>[];
      if(objs.length>best.length)best=objs;
      for(const x of v.slice(0,20))walk(x);
      return;
    }
    const mapRows=rowsFromOpenDataMap(v);
    if(mapRows.length>best.length)best=mapRows;
    for(const x of Object.values(v as Record<string,unknown>).slice(0,20))walk(x);
  }
  walk(input);return best;
}
function extractCompanies(raw: unknown): AprCompany[] {
  const directMap=rowsFromOpenDataMap(raw);
  const rows=directMap.length?directMap:Array.isArray(raw)?raw.filter(v=>v&&typeof v==='object'&&!Array.isArray(v)) as Record<string,unknown>[]:findLargestObjectCollection(raw);
  const source=rows.length?rows:(raw&&typeof raw==='object'&&!Array.isArray(raw)?[raw as Record<string,unknown>]:[]);
  const candidates=source.map(normalizeCandidate).filter(Boolean) as AprCompany[];
  const best=new Map<string,AprCompany>();
  for(const c of candidates){const key=c.registration_number||c.pib||normalizeCompanyName(c.name);if(!key)continue;const current=best.get(key);if(!current||candidateScore(c)>candidateScore(current))best.set(key,c);}
  return [...best.values()];
}

function hasContractedApi(){ return Boolean(process.env.APR_API_SEARCH_URL || process.env.APR_API_DETAIL_URL || process.env.APR_API_URL); }
function openDataUrl(){return process.env.APR_OPEN_DATA_URL||DEFAULT_OPEN_DATA_URL;}
function buildHeaders() {
  const headers: Record<string,string> = { Accept: 'application/json', 'User-Agent':'FiscalBox/1.0 (+APR Open Data integration)' };
  const token = process.env.APR_API_TOKEN;
  if (token) headers[process.env.APR_API_TOKEN_HEADER || 'Authorization'] = `${process.env.APR_API_TOKEN_PREFIX ?? 'Bearer '}${token}`;
  const username = process.env.APR_API_USERNAME;const password = process.env.APR_API_PASSWORD;
  if (!token && username && password) headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  return headers;
}
function buildUrl(template: string, query: string, mode: 'search'|'detail') {
  const digits = digitsOnly(query);const registrationNumber = digits.length === 8 ? digits : '';const pib = digits.length === 9 ? digits : '';
  let url = template.replaceAll('{{query}}', encodeURIComponent(query)).replaceAll('{query}', encodeURIComponent(query)).replaceAll('{registrationNumber}', encodeURIComponent(registrationNumber)).replaceAll('{mb}', encodeURIComponent(registrationNumber)).replaceAll('{pib}', encodeURIComponent(pib));
  if (url === template) {const u = new URL(template);u.searchParams.set(process.env.APR_API_QUERY_PARAM || (mode === 'search' ? 'q' : digits.length === 9 ? 'pib' : 'mb'), query);url = u.toString();}
  return url;
}
async function fetchJson(url:string,timeoutMs:number,init:RequestInit={}){
  if(!url)throw new Error('APR izvor nije podešen. PIB možete pretražiti kroz NBS ili uneti podatke ručno.');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(url,{...init,headers:{...buildHeaders(),...(init.headers as Record<string,string>||{})},cache:'no-store',signal:controller.signal});
    if(!response.ok)throw new Error(`APR servis je vratio HTTP ${response.status}.`);
    try{return await response.json()}catch{throw new Error('APR servis nije vratio JSON odgovor.')}
  }finally{clearTimeout(timer);}
}
async function fetchApr(template: string, query: string, mode: 'search'|'detail') {
  const method = (process.env.APR_API_METHOD || 'GET').toUpperCase();const init:RequestInit={method};const target=buildUrl(template,query,mode);
  if(method==='POST'){(init.headers as Record<string,string>)={'Content-Type':'application/json'};init.body=JSON.stringify({query,registrationNumber:digitsOnly(query).length===8?digitsOnly(query):null,pib:digitsOnly(query).length===9?digitsOnly(query):null});}
  return fetchJson(target,Number(process.env.APR_API_TIMEOUT_MS||15000),init);
}
async function loadOpenData(){
  const ttl=Number(process.env.APR_OPEN_DATA_CACHE_MS||6*60*60*1000);
  if(openDataCache&&Date.now()-openDataCache.at<ttl)return openDataCache.companies;
  if(openDataPromise)return openDataPromise;
  openDataPromise=(async()=>{
    const raw=await fetchJson(openDataUrl(),Number(process.env.APR_OPEN_DATA_TIMEOUT_MS||60000));
    const companies=extractCompanies(raw);
    if(!companies.length)throw new Error('APR Open Data odgovor nije prepoznat.');
    openDataCache={at:Date.now(),companies};return companies;
  })();
  try{return await openDataPromise}finally{openDataPromise=null;}
}
function rankOpenData(companies:AprCompany[],query:string,limit:number){
  const q=normalizeCompanyName(query);const digits=digitsOnly(query);
  const rows=companies.filter(c=>{
    if(digits.length===8&&c.registration_number===digits)return true;
    if(digits.length===9&&c.pib===digits)return true;
    return q.length>=2&&normalizeCompanyName(c.name).includes(q);
  });
  rows.sort((a,b)=>{
    const an=normalizeCompanyName(a.name),bn=normalizeCompanyName(b.name);
    const ar=(digits&&((a.registration_number===digits)||(a.pib===digits)))?0:an===q?1:an.startsWith(q)?2:3;
    const br=(digits&&((b.registration_number===digits)||(b.pib===digits)))?0:bn===q?1:bn.startsWith(q)?2:3;
    return ar-br||an.localeCompare(bn,'sr');
  });
  return rows.slice(0,Math.max(1,Math.min(20,limit)));
}

export class APRSyncService {
  static isConfigured() { return hasContractedApi() || Boolean(openDataUrl()); }
  static sourceMode(){return hasContractedApi()?'contracted':'open-data-bulk';}
  static sourceUrl(){return hasContractedApi()?(process.env.APR_API_SEARCH_URL||process.env.APR_API_URL||'configured'):openDataUrl();}

  static async search(query: string, limit = 15) {
    const template = process.env.APR_API_SEARCH_URL || process.env.APR_API_URL;
    if(template){const raw=await fetchApr(template,query,'search');return extractCompanies(raw).slice(0,Math.max(1,Math.min(20,limit)));}
    const error:any=new Error('APR Open Data je bulk snapshot. Pokrenite APR Sync da biste osvežili centralni indeks.');
    error.code='APR_BULK_SYNC_REQUIRED'; throw error;
  }
  static async detail(query: string) {
    const template = process.env.APR_API_DETAIL_URL || process.env.APR_API_URL || process.env.APR_API_SEARCH_URL;
    if(template){const raw=await fetchApr(template,query,'detail');const candidates=extractCompanies(raw);const digits=digitsOnly(query);return candidates.find(c=>c.registration_number===digits||c.pib===digits)||candidates[0]||null;}
    const error:any=new Error('APR Open Data se osvežava periodičnim bulk sync procesom.');
    error.code='APR_BULK_SYNC_REQUIRED'; throw error;
  }

  static async upsert(company: AprCompany, runId?: string): Promise<SyncResult> {
    const admin = createAdminClient();let existing:any=null;
    if(company.registration_number){const {data}=await admin.from('companies').select('*').eq('registration_number',company.registration_number).maybeSingle();existing=data;}
    if(!existing&&company.pib){const {data}=await admin.from('companies').select('*').eq('pib',company.pib).maybeSingle();existing=data;}
    const payload:any={name:company.name,normalized_name:normalizeCompanyName(company.name),registration_number:company.registration_number,pib:company.pib,address:company.address,city:company.city,municipality:company.municipality,postal_code:company.postal_code,legal_form:company.legal_form,activity_code:company.activity_code,activity_name:company.activity_name,registry_status:company.registry_status,founded_at:company.founded_at,apr_source_id:company.apr_source_id,apr_last_sync:new Date().toISOString(),apr_raw:company.apr_raw??null,source_status:'apr',manual_review_required:false,updated_at:new Date().toISOString()};
    if(existing){const changed=['name','registration_number','pib','address','city','municipality','postal_code','legal_form','activity_code','activity_name','registry_status','founded_at','apr_source_id'].some(k=>String(existing[k]??'')!==String(payload[k]??''));const {data,error}=await admin.from('companies').update(payload).eq('id',existing.id).select('*').single();if(error)throw error;if(changed)await admin.from('company_audit_log').insert({company_id:existing.id,action:'APR_SYNC_UPDATE',source:'apr',details:{run_id:runId||null}});return{company:publicCompany(data),inserted:false,updated:changed};}
    const {data,error}=await admin.from('companies').insert({...payload,created_at:new Date().toISOString()}).select('*').single();if(error)throw error;await admin.from('company_audit_log').insert({company_id:data.id,action:'APR_SYNC_INSERT',source:'apr',details:{run_id:runId||null}});return{company:publicCompany(data),inserted:true,updated:false};
  }
  static async searchAndSync(query: string, limit = 15) {
    const admin=createAdminClient();const {data:run}=await admin.from('apr_sync_runs').insert({run_type:'search',status:'running'}).select('id').single();const results:CompanyRecord[]=[];let inserted=0,updated=0,errors=0;
    try{const candidates=await this.search(query,limit);for(const candidate of candidates){try{const result=await this.upsert(candidate,run?.id);results.push(result.company);if(result.inserted)inserted++;if(result.updated)updated++;}catch(e){errors++;console.error('APR sync candidate',e);}}if(run?.id)await admin.from('apr_sync_runs').update({status:errors?'partial':'success',companies_seen:candidates.length,inserted_count:inserted,updated_count:updated,error_count:errors,finished_at:new Date().toISOString()}).eq('id',run.id);return results;}catch(e:any){if(run?.id)await admin.from('apr_sync_runs').update({status:'failed',error_count:1,error_summary:String(e?.message||e).slice(0,500),finished_at:new Date().toISOString()}).eq('id',run.id);throw e;}
  }
  static async syncExact(query: string) {const candidate=await this.detail(query);if(!candidate)return null;return(await this.upsert(candidate)).company;}
  static async syncExisting(companyId: string) {const admin=createAdminClient();const {data:company,error}=await admin.from('companies').select('*').eq('id',companyId).single();if(error)throw error;const query=company.registration_number||company.pib||company.name;if(!query)throw new Error('Firma nema podatak za APR osvežavanje.');return this.syncExact(query);}
}
