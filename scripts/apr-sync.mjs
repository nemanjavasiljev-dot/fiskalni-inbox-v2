const APR_URL = process.env.APR_OPEN_DATA_URL || 'https://openapi.apr.gov.rs/api/opendata/companies';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const BATCH_SIZE = Math.max(100, Math.min(2000, Number(process.env.APR_SYNC_BATCH_SIZE || 750)));

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY).');
  process.exit(1);
}

const CYR = {
  'а':'a','б':'b','в':'v','г':'g','д':'d','ђ':'dj','е':'e','ж':'z','з':'z','и':'i','ј':'j','к':'k','л':'l','љ':'lj','м':'m','н':'n','њ':'nj','о':'o','п':'p','р':'r','с':'s','т':'t','ћ':'c','у':'u','ф':'f','х':'h','ц':'c','ч':'c','џ':'dz','ш':'s'
};
const latinize = v => Array.from(String(v ?? '').toLowerCase()).map(ch => CYR[ch] ?? ch).join('').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[čćžšđ]/g,ch=>({č:'c',ć:'c',ž:'z',š:'s',đ:'d'}[ch]||ch));
const norm = v => latinize(v).replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const digits = v => String(v ?? '').replace(/\D/g,'');
const keyify = v => norm(v).replace(/\s/g,'');

function scalar(obj, aliases) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return '';
  const wanted = new Set(aliases.map(keyify));
  for (const [k,v] of Object.entries(obj)) {
    if (wanted.has(keyify(k)) && ['string','number','boolean'].includes(typeof v)) return String(v ?? '').trim();
  }
  return '';
}
function child(obj, aliases) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const wanted = new Set(aliases.map(keyify));
  for (const [k,v] of Object.entries(obj)) {
    if (wanted.has(keyify(k)) && v && typeof v === 'object' && !Array.isArray(v)) return v;
  }
  return null;
}
function childName(obj) { return scalar(obj,['name','naziv','title','value']); }
function parseDate(v){ if(!v)return null; const d=new Date(v); return Number.isNaN(d.getTime())?null:d.toISOString().slice(0,10); }

function locateRegistryMap(raw) {
  const seen = new Set();
  let best = null;
  function walk(v, depth=0) {
    if (!v || typeof v !== 'object' || Array.isArray(v) || seen.has(v) || depth>5) return;
    seen.add(v);
    const entries = Object.entries(v);
    const keyed = entries.filter(([k,val]) => /^\d{8}$/.test(k) && val && typeof val === 'object' && !Array.isArray(val));
    if (keyed.length && (!best || keyed.length > best.length)) best = keyed;
    for (const [,val] of entries.slice(0,50)) walk(val, depth+1);
  }
  walk(raw);
  return best || [];
}

function rowFrom(registrationNumber, obj) {
  const name = scalar(obj,['businessName','business name','poslovnoIme','poslovno ime','name','naziv']);
  if (!name) return null;
  const municipalityObj = child(obj,['municipality','opstina','opština']);
  const activityObj = child(obj,['activity','mainActivity','registeredActivity','pretežna delatnost','pretezna delatnost']);
  const status = scalar(obj,['status','registryStatus','registrationStatus']);
  const legalForm = scalar(obj,['legalForm','legal form','pravnaForma','pravna forma']);
  const founded = scalar(obj,['incorporationDate','foundedAt','registrationDate','datum osnivanja']);
  const activityCode = scalar(obj,['activityCode','mainActivityCode','sifra delatnosti','šifra delatnosti']) || scalar(activityObj,['code','sifra','šifra']);
  const activityName = scalar(obj,['activityName','mainActivityName','naziv delatnosti']) || childName(activityObj);
  const municipality = scalar(obj,['municipalityName','opstina','opština']) || childName(municipalityObj);
  const city = scalar(obj,['city','place','mesto','naselje']);
  const address = scalar(obj,['address','registeredAddress','adresa']);
  const postal = digits(scalar(obj,['postalCode','zip','postanski broj','poštanski broj']));
  return {
    name,
    registration_number: registrationNumber,
    pib: null,
    address: address || null,
    city: city || null,
    municipality: municipality || null,
    postal_code: postal || null,
    legal_form: legalForm || null,
    activity_code: activityCode || null,
    activity_name: activityName || null,
    registry_status: status || null,
    founded_at: parseDate(founded),
    apr_source_id: registrationNumber,
    apr_raw: obj,
  };
}

async function api(path, {method='GET', body, prefer}={}) {
  const r = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type':'application/json',
      ...(prefer?{Prefer:prefer}:{})
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${await r.text()}`);
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

async function main(){
  console.log(`Downloading APR snapshot: ${APR_URL}`);
  const res=await fetch(APR_URL,{headers:{Accept:'application/json','User-Agent':'FiscalBox APR sync/5.3'}});
  if(!res.ok)throw new Error(`APR download failed: HTTP ${res.status}`);
  const raw=await res.json();
  const entries=locateRegistryMap(raw);
  if(entries.length<1000)throw new Error(`APR JSON shape not recognized. Found only ${entries.length} MB-keyed records.`);
  console.log(`APR records detected: ${entries.length}`);

  const runRows=await api('/rest/v1/apr_sync_runs',{method:'POST',prefer:'return=representation',body:[{run_type:'scheduled',status:'running',companies_seen:entries.length}]});
  const runId=runRows?.[0]?.id || null;
  let inserted=0,updated=0,errors=0,processed=0;
  try{
    for(let i=0;i<entries.length;i+=BATCH_SIZE){
      const batch=[];
      for(const [mb,obj] of entries.slice(i,i+BATCH_SIZE)){
        const row=rowFrom(mb,obj);
        if(row)batch.push(row); else errors++;
      }
      if(batch.length){
        const result=await api('/rest/v1/rpc/bulk_upsert_apr_companies',{method:'POST',body:{p_rows:batch,p_run_id:runId}});
        const stat=Array.isArray(result)?result[0]:result;
        inserted+=Number(stat?.inserted_count||0);updated+=Number(stat?.updated_count||0);
      }
      processed=Math.min(entries.length,i+BATCH_SIZE);
      if(processed%5000<BATCH_SIZE)console.log(`Processed ${processed}/${entries.length} (inserted ${inserted}, updated ${updated}, errors ${errors})`);
    }
    if(runId)await api(`/rest/v1/apr_sync_runs?id=eq.${runId}`,{method:'PATCH',prefer:'return=minimal',body:{status:errors?'partial':'success',companies_seen:processed,inserted_count:inserted,updated_count:updated,error_count:errors,finished_at:new Date().toISOString()}});
    console.log(`APR sync complete. Processed=${processed}, inserted=${inserted}, updated=${updated}, errors=${errors}`);
  }catch(e){
    if(runId){try{await api(`/rest/v1/apr_sync_runs?id=eq.${runId}`,{method:'PATCH',prefer:'return=minimal',body:{status:'failed',companies_seen:processed,inserted_count:inserted,updated_count:updated,error_count:errors+1,error_summary:String(e).slice(0,500),finished_at:new Date().toISOString()}})}catch{}}
    throw e;
  }
}

main().catch(err=>{console.error(err);process.exit(1)});
