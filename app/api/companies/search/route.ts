import { NextResponse } from 'next/server';
import { APRSyncService } from '@/lib/apr-sync-service';
import { checkSearchRateLimit, digitsOnly, normalizeCompanyName, sanitizeCompanyQuery, searchLocalCompanies, type CompanyRecord } from '@/lib/company-registry';
import { createAdminClient } from '@/lib/supabase/admin';
import { searchCompaniesViaNbs, type NbsCompanyMatch } from '@/lib/nbs-company-resolver';

export const maxDuration = 30;

function clientKey(request: Request) {
  const h=request.headers;
  const forwarded=h.get('x-forwarded-for')?.split(',')[0]?.trim();
  return `companies:${forwarded||h.get('x-real-ip')||'unknown'}`;
}

async function upsertResolverMatch(match:NbsCompanyMatch){
  const admin=createAdminClient();
  const existing=await searchLocalCompanies(match.registration_number,5);
  const exact=existing.find((c:CompanyRecord)=>c.registration_number===match.registration_number);
  if(exact){
    const patch:any={updated_at:new Date().toISOString()};
    if(!exact.pib&&match.pib)patch.pib=match.pib;
    if(!exact.address&&match.address)patch.address=match.address;
    if(!exact.city&&match.city)patch.city=match.city;
    if(!exact.municipality&&match.municipality)patch.municipality=match.municipality;
    const {data,error}=await admin.from('companies').update(patch).eq('id',exact.id).select('*').maybeSingle();
    if(!error&&data){
      if(match.pib&&!exact.pib)await admin.from('company_audit_log').insert({company_id:exact.id,action:'PIB_RESOLVED',source:'system',details:{resolver:'NBS public account registry'}});
      return data as CompanyRecord;
    }
    return exact;
  }

  // Bootstrap a central-company row from the official NBS public registry so
  // registration can continue immediately. APR bulk sync will later replace/
  // enrich canonical APR fields for this MB without creating a duplicate.
  const payload:any={
    name:match.name,
    normalized_name:normalizeCompanyName(match.name),
    registration_number:match.registration_number,
    pib:match.pib,
    address:match.address,
    city:match.city,
    municipality:match.municipality,
    activity_name:match.activity_name,
    apr_source_id:match.registration_number,
    apr_last_sync:null,
    apr_raw:{resolver:'NBS public account registry',bootstrap:true},
    source_status:'manual_review',
    manual_review_required:true,
    updated_at:new Date().toISOString(),
  };
  const {data,error}=await admin.from('companies').insert(payload).select('*').single();
  if(error){
    // Another concurrent request may have inserted the same MB.
    const retry=await searchLocalCompanies(match.registration_number,5);
    return retry.find((c:CompanyRecord)=>c.registration_number===match.registration_number)||null;
  }
  await admin.from('company_audit_log').insert({company_id:data.id,action:'OFFICIAL_RESOLVER_BOOTSTRAP',source:'system',details:{resolver:'NBS public account registry',awaiting_apr_bulk_sync:true}});
  return data as CompanyRecord;
}

async function officialResolverFallback(query:string){
  const matches=await searchCompaniesViaNbs(query);
  const out:CompanyRecord[]=[];
  for(const match of matches){
    const company=await upsertResolverMatch(match);
    if(company)out.push(company);
  }
  return out.slice(0,15);
}

export async function GET(request:Request){
  const q=sanitizeCompanyQuery(new URL(request.url).searchParams.get('q'));
  const digits=digitsOnly(q);
  if(q.length<2 && ![8,9].includes(digits.length)) return NextResponse.json({results:[],warning:'Unesite najmanje 2–3 karaktera.'});
  if(!(await checkSearchRateLimit(clientKey(request)))) return NextResponse.json({error:'Previše zahteva. Pokušajte ponovo za minut.'},{status:429});

  try{
    let local=await searchLocalCompanies(q,15);
    let warning='';

    // Public APR Open Data is a full snapshot, not a per-query search API.
    // If the local APR index has not been populated yet (or PIB is requested,
    // which public APR Open Data does not expose as a standard field), use the
    // official public NBS registry only as a resolver/bootstrapping source.
    if(!local.length && APRSyncService.sourceMode()==='open-data-bulk'){
      try{
        local=await officialResolverFallback(q);
        if(local.length)warning='Firma je pronađena preko zvaničnog NBS registra. APR podaci će biti dopunjeni pri sledećoj APR sinhronizaciji.';
      }catch(e){console.error('official company resolver',e);}
    }

    if(!local.length && APRSyncService.sourceMode()==='contracted'){
      try{ await APRSyncService.searchAndSync(q,15); local=await searchLocalCompanies(q,15); }
      catch(e){ console.error('APR contracted company search',e); warning='APR web-servis trenutno nije dostupan. Prikazani su lokalno sinhronizovani podaci.'; }
    }

    if(!local.length && !warning){
      warning=digits.length===9
        ? 'PIB nije pronađen u zvaničnim izvorima. Proverite PIB ili pokušajte naziv/matični broj.'
        : 'Firma nije pronađena. Ako je APR indeks tek postavljen, pokrenite APR Open Data Sync u GitHub Actions.';
    }
    return NextResponse.json({results:local,apr_configured:true,apr_source:APRSyncService.sourceMode(),warning});
  }catch(e:any){
    console.error('companies-search',e);
    return NextResponse.json({error:'Pretraga firmi trenutno nije dostupna. Proverite da li su SQL 010 i 011 pokrenuti.'},{status:500});
  }
}
