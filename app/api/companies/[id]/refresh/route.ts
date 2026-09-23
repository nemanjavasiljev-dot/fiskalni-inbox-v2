import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { APRSyncService } from '@/lib/apr-sync-service';
export async function POST(_:Request,{params}:{params:Promise<{id:string}>}){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:'Niste prijavljeni.'},{status:401});
  const {id}=await params;const admin=createAdminClient();const {data:profile}=await admin.from('profiles').select('global_role').eq('user_id',user.id).maybeSingle();
  const {data:orgs}=await admin.from('organizations').select('id').eq('company_id',id);const orgIds=(orgs||[]).map((o:any)=>o.id);
  let allowed=profile?.global_role==='master_admin';if(!allowed&&orgIds.length){const {data:m}=await admin.from('organization_members').select('id').eq('user_id',user.id).in('organization_id',orgIds).limit(1);allowed=Boolean(m?.length);}
  if(!allowed)return NextResponse.json({error:'Nemate pravo da osvežite ovu firmu.'},{status:403});
  if(!APRSyncService.isConfigured())return NextResponse.json({error:'APR web-servis nije konfigurisan.'},{status:503});
  try{const company=await APRSyncService.syncExisting(id);return NextResponse.json({company});}catch(e:any){console.error('apr-refresh',e);return NextResponse.json({error:'APR podaci trenutno nisu dostupni. Pokušajte ponovo.'},{status:502});}
}
