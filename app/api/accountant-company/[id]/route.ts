import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:'Niste prijavljeni.'},{status:401});
  const {id}=await params;
  const body=await request.json().catch(()=>({}));
  const decision=body.decision==='approve'?'active':body.decision==='reject'?'rejected':'';
  if(!decision)return NextResponse.json({error:'Nepoznata odluka.'},{status:400});
  const admin=createAdminClient();
  const {data:rel}=await admin.from('accountant_company').select('*').eq('id',id).eq('status','pending').maybeSingle();
  if(!rel)return NextResponse.json({error:'Zahtev više nije aktivan.'},{status:404});
  const {data:clientOrg}=await admin.from('organizations').select('id,owner_user_id').eq('company_id',rel.company_id).eq('organization_type','company').limit(1).maybeSingle();
  const {data:profile}=await admin.from('profiles').select('global_role').eq('user_id',user.id).maybeSingle();
  if(profile?.global_role!=='master_admin'&&clientOrg?.owner_user_id!==user.id)return NextResponse.json({error:'Nemate pravo da odlučujete o ovom zahtevu.'},{status:403});
  if(decision==='active'){
    const {data:office}=await admin.from('organizations').select('owner_user_id').eq('id',rel.accountant_organization_id).maybeSingle();
    if(!clientOrg||!office)return NextResponse.json({error:'Veza firmi nije kompletna.'},{status:409});
    const {error:mErr}=await admin.from('organization_members').upsert({organization_id:clientOrg.id,user_id:office.owner_user_id,role:'accountant'},{onConflict:'organization_id,user_id',ignoreDuplicates:true});
    if(mErr)return NextResponse.json({error:mErr.message},{status:400});
  }
  const {error}=await admin.from('accountant_company').update({status:decision,client_organization_id:clientOrg?.id||rel.client_organization_id,approved_by:decision==='active'?user.id:null,approved_at:decision==='active'?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq('id',id);
  if(error)return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({ok:true,message:decision==='active'?'Knjigovođa je povezan sa firmom.':'Zahtev knjigovođe je odbijen.'});
}
