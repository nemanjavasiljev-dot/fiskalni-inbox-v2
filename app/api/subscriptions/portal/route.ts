import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { retrieveSubscription } from '@/lib/subscriptions';

export async function GET(request:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.redirect(new URL('/login',request.url));
  const organizationId=new URL(request.url).searchParams.get('organization_id')||'';
  const admin=createAdminClient();
  const {data:org}=await admin.from('organizations').select('id,owner_user_id,organization_type').eq('id',organizationId).maybeSingle();
  if(!org) return NextResponse.json({error:'Organizacija nije pronađena.'},{status:404});
  const {data:member}=await admin.from('organization_members').select('role,accounting_access_role').eq('organization_id',organizationId).eq('user_id',user.id).maybeSingle();
  const allowed=org.owner_user_id===user.id || (org.organization_type==='accounting'&&member?.role==='employee'&&member?.accounting_access_role==='admin');
  if(!allowed) return NextResponse.json({error:'Nemate pravo upravljanja pretplatom.'},{status:403});
  const {data:sub}=await admin.from('subscriptions').select('provider_subscription_id').eq('organization_id',organizationId).maybeSingle();
  if(!sub?.provider_subscription_id) return NextResponse.redirect(new URL(`/app/subscription?organization_id=${encodeURIComponent(organizationId)}`,request.url));
  try{
    const providerSub=await retrieveSubscription(String(sub.provider_subscription_id));
    const portal=providerSub?.attributes?.urls?.customer_portal;
    if(!portal) throw new Error('Portal za pretplatu nije dostupan.');
    return NextResponse.redirect(portal);
  }catch(e:any){
    return NextResponse.redirect(new URL(`/app/subscription?organization_id=${encodeURIComponent(organizationId)}&portal_error=1`,request.url));
  }
}
