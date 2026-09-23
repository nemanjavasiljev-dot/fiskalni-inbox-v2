import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireMaster } from '@/lib/master-auth';
import { APRSyncService } from '@/lib/apr-sync-service';

export async function POST(request:Request){
  const auth=await requireMaster();if(!auth.ok)return NextResponse.json({error:auth.error},{status:auth.status});
  if(APRSyncService.sourceMode()==='open-data-bulk')return NextResponse.json({error:'APR Open Data je bulk snapshot. Sinhronizaciju pokrenite kroz GitHub Actions → APR Open Data Sync → Run workflow.'},{status:409});
  if(!APRSyncService.isConfigured())return NextResponse.json({error:'APR web-servis nije konfigurisan. Unesite ugovorene APR .env vrednosti.'},{status:503});
  const body=await request.json().catch(()=>({}));const companyId=String(body.company_id||'');const limit=Math.max(1,Math.min(100,Number(body.limit||50)));
  const admin=createAdminClient();const {data:run}=await admin.from('apr_sync_runs').insert({run_type:'manual',status:'running',requested_by:auth.user.id}).select('id').single();
  let seen=0,inserted=0,updated=0,errors=0;const messages:string[]=[];
  try{
    const {data:companies,error}=companyId?await admin.from('companies').select('*').eq('id',companyId):await admin.from('companies').select('*').order('apr_last_sync',{ascending:true,nullsFirst:true}).limit(limit);
    if(error)throw error;
    for(const company of companies||[]){seen++;try{const query=company.registration_number||company.pib;if(!query){errors++;messages.push(`${company.name}: nema MB/PIB`);continue;}const candidate=await APRSyncService.detail(query);if(!candidate){errors++;messages.push(`${company.name}: APR nije vratio podatke`);continue;}const result=await APRSyncService.upsert(candidate,run?.id);if(result.inserted)inserted++;if(result.updated)updated++;}catch(e:any){errors++;messages.push(`${company.name}: ${String(e?.message||e)}`.slice(0,180));}}
    if(run?.id)await admin.from('apr_sync_runs').update({status:errors?(errors===seen?'failed':'partial'):'success',companies_seen:seen,inserted_count:inserted,updated_count:updated,error_count:errors,error_summary:messages.slice(0,5).join(' | ')||null,finished_at:new Date().toISOString()}).eq('id',run.id);
    return NextResponse.json({ok:true,seen,inserted,updated,errors,messages:messages.slice(0,10)});
  }catch(e:any){if(run?.id)await admin.from('apr_sync_runs').update({status:'failed',error_count:1,error_summary:String(e?.message||e).slice(0,500),finished_at:new Date().toISOString()}).eq('id',run.id);return NextResponse.json({error:'APR sinhronizacija nije uspela.'},{status:500});}
}
