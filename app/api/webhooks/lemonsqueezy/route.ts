import { createHmac, createHash, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { planForVariant, type FiscalBoxPlan } from '@/lib/subscriptions';

function verify(raw:string, signature:string, secret:string){
  if(!signature||!secret) return false;
  const expected=createHmac('sha256',secret).update(raw).digest('hex');
  const a=Buffer.from(expected,'utf8');const b=Buffer.from(signature,'utf8');
  return a.length===b.length && timingSafeEqual(a,b);
}
function localSubscriptionStatus(providerStatus:string){
  if(providerStatus==='on_trial') return 'active';
  if(['active','paused','past_due','unpaid','cancelled','expired'].includes(providerStatus)) return providerStatus;
  return 'pending_checkout';
}
function orgStatus(providerStatus:string, endsAt?:string|null){
  if(['on_trial','active','paused','past_due'].includes(providerStatus)) return providerStatus==='on_trial'?'trial':'active';
  if(providerStatus==='cancelled' && endsAt && new Date(endsAt).getTime()>Date.now()) return 'active';
  if(providerStatus==='expired') return 'cancelled';
  return 'pending_payment';
}
function billingStatus(status:string){
  if(status==='paid') return 'paid';
  if(status==='refunded') return 'refunded';
  if(status==='partial_refund') return 'partial_refund';
  if(status==='void') return 'cancelled';
  return 'unpaid';
}

export async function POST(request:Request){
  const raw=await request.text();
  const secret=String(process.env.LEMONSQUEEZY_WEBHOOK_SECRET||'');
  const signature=String(request.headers.get('x-signature')||'');
  if(!verify(raw,signature,secret)) return NextResponse.json({error:'Invalid signature.'},{status:401});
  let payload:any;
  try{payload=JSON.parse(raw);}catch{return NextResponse.json({error:'Invalid JSON.'},{status:400});}
  const event=String(payload?.meta?.event_name||request.headers.get('x-event-name')||'unknown');
  const data=payload?.data||{};const attrs=data?.attributes||{};
  if(attrs?.test_mode===true) return NextResponse.json({ok:true,ignored:'test_mode'});

  const admin=createAdminClient();
  const hash=createHash('sha256').update(raw).digest('hex');
  async function apply(organizationId:string, subscription:any, organization:any, invoice:any=null){
    const {data,error}=await admin.rpc('apply_billing_event',{
      p_hash:hash,p_event:event,p_payload:payload,p_org:organizationId,
      p_subscription:subscription,p_organization:organization,p_invoice:invoice
    });
    if(error){console.error('billing-transaction',error.code);return NextResponse.json({error:'Naplata nije obrađena. Pokušajte ponovo.'},{status:503});}
    return NextResponse.json({ok:true,...data});
  }

  const custom=payload?.meta?.custom_data||{};
  let organizationId=String(custom.organization_id||'');
  let subscriptionRow:any=null;

  const subscriptionEvents=new Set(['subscription_created','subscription_updated','subscription_cancelled','subscription_resumed','subscription_expired','subscription_paused','subscription_unpaused']);
  if(subscriptionEvents.has(event)){
    const providerSubscriptionId=String(data.id||'');
    if(!organizationId){
      const {data:existing}=await admin.from('subscriptions').select('*').eq('provider_subscription_id',providerSubscriptionId).maybeSingle();
      subscriptionRow=existing;organizationId=String(existing?.organization_id||'');
    }
    if(!organizationId) return NextResponse.json({error:'Organizacija nije pronađena; ponovite isporuku.'},{status:503});
    const plan=planForVariant(attrs.variant_id);
    if(!plan)return NextResponse.json({error:'Nepoznat paket naplate.'},{status:400});
    if(String(attrs.store_id)!==String(process.env.LEMONSQUEEZY_STORE_ID))return NextResponse.json({error:'Pogrešna prodavnica.'},{status:400});
    const providerStatus=String(attrs.status||'');
    const quantity=Math.max(1,Number(attrs?.first_subscription_item?.quantity||custom.quantity||1));
    const update:any={
      plan,seat_count:quantity,provider:'lemonsqueezy',provider_customer_id:String(attrs.customer_id||'')||null,
      provider_subscription_id:providerSubscriptionId,provider_variant_id:String(attrs.variant_id||'')||null,
      provider_status:providerStatus,provider_test_mode:false,status:localSubscriptionStatus(providerStatus),
      trial_ends_at:attrs.trial_ends_at||null,current_period_end:attrs.renews_at||attrs.ends_at||null,
      renews_at:attrs.renews_at||null,ends_at:attrs.ends_at||null,payment_processor:attrs.payment_processor||null,
      card_brand:attrs.card_brand||null,card_last_four:attrs.card_last_four||null,
      customer_portal_url:attrs?.urls?.customer_portal||null,update_payment_url:attrs?.urls?.update_payment_method||null,
      provider_updated_at:attrs.updated_at||attrs.created_at||null,last_webhook_at:new Date().toISOString(),activated_at:['on_trial','active'].includes(providerStatus)?new Date().toISOString():undefined
    };
    Object.keys(update).forEach(k=>update[k]===undefined&&delete update[k]);
    return apply(organizationId,update,{plan,status:orgStatus(providerStatus,attrs.ends_at||null),trial_ends_at:attrs.trial_ends_at||null});
  }

  if(['subscription_payment_success','subscription_payment_failed','subscription_payment_recovered','subscription_payment_refunded'].includes(event)){
    const providerSubscriptionId=String(attrs.subscription_id||'');
    const {data:sub}=await admin.from('subscriptions').select('*').eq('provider_subscription_id',providerSubscriptionId).maybeSingle();
    if(!sub) return NextResponse.json({error:'Pretplata još nije obrađena; ponovite isporuku.'},{status:503});
    organizationId=String(sub.organization_id);
    const {data:org}=await admin.from('organizations').select('*').eq('id',organizationId).maybeSingle();
    if(!org) return NextResponse.json({error:'Organizacija nije dostupna.'},{status:503});
    const qty=Math.max(1,Number(sub.seat_count||1));
    const subtotal=Number(attrs.subtotal||0)/100;
    const tax=Number(attrs.tax||0)/100;
    const total=Number(attrs.total||0)/100;
    const currency=String(attrs.currency||'RSD').toUpperCase();
    const status=billingStatus(String(attrs.status|| (['subscription_payment_success','subscription_payment_recovered'].includes(event)?'paid':event==='subscription_payment_refunded'?'refunded':'pending')));
    const invoiceNumber=`LS-${String(data.id||'').toUpperCase()}`;
    const invoice:any={
      organization_id:organizationId,invoice_number:invoiceNumber,document_type:'invoice',plan:sub.plan||'basic',quantity:qty,
      unit_price_net:qty?subtotal/qty:subtotal,subtotal_net:subtotal,vat_rate:subtotal?Math.round((tax/subtotal)*10000)/100:0,
      vat_amount:tax,total_amount:total,currency,status,issued_at:attrs.created_at||new Date().toISOString(),
      paid_at:status==='paid'?new Date().toISOString():null,recipient_name:attrs.user_name||org.name,recipient_pib:org.pib||null,
      recipient_address:org.address||null,recipient_email:attrs.user_email||org.contact_email||null,
      issuer_snapshot:{provider:'Lemon Squeezy',merchant_of_record:true},provider:'lemonsqueezy',provider_invoice_id:String(data.id||''),
      external_invoice_url:attrs?.urls?.invoice_url||null,provider_status:String(attrs.status||''),billing_reason:attrs.billing_reason||null,
      payment_processor:attrs.payment_processor||null,card_brand:attrs.card_brand||null,card_last_four:attrs.card_last_four||null
    };
    const organizationUpdate:any={};
    const subUpdate:any={last_webhook_at:new Date().toISOString()};
    if(event==='subscription_payment_success'||event==='subscription_payment_recovered'){
      subUpdate.last_payment_at=new Date().toISOString();
      if(sub.status==='past_due'||sub.status==='unpaid') subUpdate.status='active';
      if(sub.status==='past_due'||sub.status==='unpaid'||sub.status==='active')organizationUpdate.status='active';
    }else if(event==='subscription_payment_failed'){
      subUpdate.status='past_due';
    } else if(event==='subscription_payment_refunded'){
      subUpdate.last_webhook_at=new Date().toISOString();
    }
    return apply(organizationId,subUpdate,organizationUpdate,invoice);
  }

  return NextResponse.json({ok:true,ignored:event});
}
