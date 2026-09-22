import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireMaster } from '@/lib/master-auth';

export async function GET(){
  const auth=await requireMaster();if(!auth.ok)return NextResponse.json({error:auth.error},{status:auth.status});
  const admin=createAdminClient();
  const [{count:companies},{count:review},{data:lastRun},{data:last24}] = await Promise.all([
    admin.from('companies').select('id',{count:'exact',head:true}),
    admin.from('company_migration_review').select('id',{count:'exact',head:true}).eq('status','pending'),
    admin.from('apr_sync_runs').select('*').order('started_at',{ascending:false}).limit(1).maybeSingle(),
    admin.from('apr_sync_runs').select('inserted_count,updated_count,error_count').gte('started_at',new Date(Date.now()-24*60*60*1000).toISOString())
  ]);
  const summary=(last24||[]).reduce((a:any,x:any)=>({inserted:a.inserted+Number(x.inserted_count||0),updated:a.updated+Number(x.updated_count||0),errors:a.errors+Number(x.error_count||0)}),{inserted:0,updated:0,errors:0});
  return NextResponse.json({companies:companies||0,pending_review:review||0,last_sync:lastRun?.finished_at||lastRun?.started_at||null,new_companies_24h:summary.inserted,updated_companies_24h:summary.updated,errors_24h:summary.errors,last_run:lastRun||null});
}
