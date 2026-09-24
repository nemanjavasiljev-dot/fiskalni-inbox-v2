import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:'Niste prijavljeni.'},{status:401});
  const {id}=await params;
  const body=await request.json().catch(()=>({}));
  const decision=body.decision==='approve'?'approved':body.decision==='reject'?'rejected':'';
  if(!decision)return NextResponse.json({error:'Nepoznata odluka.'},{status:400});
  const admin=createAdminClient();
  const {data:req}=await admin.from('company_access_requests').select('*').eq('id',id).eq('status','pending').maybeSingle();
  if(!req)return NextResponse.json({error:'Zahtev više nije aktivan.'},{status:404});
  const {data:org}=await admin.from('organizations').select('id,owner_user_id,company_id').eq('id',req.organization_id).maybeSingle();
  const {data:profile}=await admin.from('profiles').select('global_role').eq('user_id',user.id).maybeSingle();
  const allowed=profile?.global_role==='master_admin'||org?.owner_user_id===user.id;
  if(!allowed)return NextResponse.json({error:'Nemate pravo da odlučujete o ovom zahtevu.'},{status:403});
  if(decision==='approved'){
    const {error:mErr}=await admin.from('organization_members').upsert({organization_id:req.organization_id,user_id:req.requester_user_id,role:'employee'},{onConflict:'organization_id,user_id',ignoreDuplicates:true});
    if(mErr)return NextResponse.json({error:mErr.message},{status:400});
    await admin.from('profiles').update({primary_company_id:req.company_id}).eq('user_id',req.requester_user_id);
  }
  const {error}=await admin.from('company_access_requests').update({status:decision,reviewed_by:user.id,reviewed_at:new Date().toISOString()}).eq('id',id);
  if(error)return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({ok:true,message:decision==='approved'?'Pristup firmi je odobren.':'Zahtev je odbijen.'});
}
