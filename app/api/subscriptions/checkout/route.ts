import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { billingProviderConfigured, createCheckout, type FiscalBoxPlan } from '@/lib/subscriptions';

export async function POST(request:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.json({error:'Niste prijavljeni.'},{status:401});
  const body=await request.json();
  const organizationId=String(body.organization_id||'');
  const plan: FiscalBoxPlan=body.plan==='premium'?'premium':'basic';
  if(!organizationId) return NextResponse.json({error:'Nedostaje organizacija.'},{status:400});
  if(!billingProviderConfigured()) return NextResponse.json({error:'Online pretplate još nisu povezane sa produkcionim payment nalogom. Unesite Lemon Squeezy Vercel ključeve.'},{status:503});

  const admin=createAdminClient();
  const {data:org}=await admin.from('organizations').select('id,name,owner_user_id,organization_type,status').eq('id',organizationId).maybeSingle();
  if(!org) return NextResponse.json({error:'Organizacija nije pronađena.'},{status:404});
  const {data:membership}=await admin.from('organization_members').select('role,accounting_access_role').eq('organization_id',organizationId).eq('user_id',user.id).maybeSingle();
  const allowed=org.owner_user_id===user.id || (org.organization_type==='accounting' && membership?.role==='employee' && membership?.accounting_access_role==='admin');
  if(!allowed) return NextResponse.json({error:'Samo administrator naloga može aktivirati pretplatu.'},{status:403});

  const {data:subscription}=await admin.from('subscriptions').select('*').eq('organization_id',organizationId).maybeSingle();
  const cancelledStillActive=subscription?.status==='cancelled' && new Date(subscription?.ends_at||subscription?.current_period_end||0).getTime()>Date.now();
  if(subscription?.provider_subscription_id && (['active','paused','past_due'].includes(String(subscription.status))||cancelledStillActive)){
    return NextResponse.json({error:'Pretplata već postoji. Koristite Upravljaj pretplatom za izmene.'},{status:409});
  }

  const {count}=await admin.from('organization_members').select('id',{count:'exact',head:true}).eq('organization_id',organizationId).in('role',['owner','employee']);
  const seats=Math.max(1,Number(count||1));
  const redirectUrl=`${new URL(request.url).origin}/app/subscription?checkout=return`;
  let checkout;
  try{
    checkout=await createCheckout({plan,organizationId,userId:user.id,email:user.email||'',name:org.name,quantity:seats,redirectUrl});
  }catch(e:any){
    return NextResponse.json({error:e?.message||'Checkout nije mogao da se kreira.'},{status:502});
  }
  if(!checkout.url) return NextResponse.json({error:'Payment provider nije vratio checkout URL.'},{status:502});

  const trialStillActive=subscription?.status==='trial' && subscription?.trial_ends_at && new Date(subscription.trial_ends_at).getTime()>Date.now();
  const subUpdate:any={
    plan,seat_count:seats,provider:'lemonsqueezy',provider_checkout_id:checkout.checkoutId,
    checkout_started_at:new Date().toISOString(),provider_test_mode:false
  };
  if(!trialStillActive) subUpdate.status='pending_checkout';
  await admin.from('subscriptions').update(subUpdate).eq('organization_id',organizationId);
  await admin.from('organizations').update({plan,...(!trialStillActive?{status:'pending_payment'}:{})}).eq('id',organizationId);

  return NextResponse.json({ok:true,url:checkout.url});
}
