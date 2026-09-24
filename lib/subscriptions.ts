export type FiscalBoxPlan = 'basic' | 'premium';

const API_BASE = 'https://api.lemonsqueezy.com/v1';

function required(name:string){
  const value=process.env[name]?.trim();
  if(!value) throw new Error(`Nedostaje Vercel promenljiva ${name}.`);
  return value;
}

export function billingProviderConfigured(){
  return Boolean(
    process.env.LEMONSQUEEZY_API_KEY?.trim() &&
    process.env.LEMONSQUEEZY_STORE_ID?.trim() &&
    process.env.LEMONSQUEEZY_BASIC_VARIANT_ID?.trim() &&
    process.env.LEMONSQUEEZY_PREMIUM_VARIANT_ID?.trim() &&
    process.env.LEMONSQUEEZY_WEBHOOK_SECRET?.trim()
  );
}

export function variantForPlan(plan:FiscalBoxPlan){
  return plan==='premium' ? required('LEMONSQUEEZY_PREMIUM_VARIANT_ID') : required('LEMONSQUEEZY_BASIC_VARIANT_ID');
}

export function planForVariant(variantId:unknown):FiscalBoxPlan|null{
  const id=String(variantId||'');
  if(id && id===String(process.env.LEMONSQUEEZY_BASIC_VARIANT_ID||'')) return 'basic';
  if(id && id===String(process.env.LEMONSQUEEZY_PREMIUM_VARIANT_ID||'')) return 'premium';
  return null;
}

async function lsFetch(path:string, init:RequestInit={}){
  const apiKey=required('LEMONSQUEEZY_API_KEY');
  const response=await fetch(`${API_BASE}${path}`,{
    ...init,
    headers:{
      Accept:'application/vnd.api+json',
      'Content-Type':'application/vnd.api+json',
      Authorization:`Bearer ${apiKey}`,
      ...(init.headers||{})
    },
    signal:AbortSignal.timeout(15000),
    cache:'no-store'
  });
  const text=await response.text();
  let json:any={};
  try{json=text?JSON.parse(text):{};}catch{json={raw:text};}
  if(!response.ok){
    const message=json?.errors?.[0]?.detail||json?.message||`Billing provider HTTP ${response.status}`;
    throw new Error(message);
  }
  return json;
}

export async function createCheckout(opts:{
  plan:FiscalBoxPlan;
  organizationId:string;
  userId:string;
  email:string;
  name?:string|null;
  quantity:number;
  redirectUrl:string;
}){
  const storeId=required('LEMONSQUEEZY_STORE_ID');
  const variantId=variantForPlan(opts.plan);
  const quantity=Math.max(1,Math.floor(Number(opts.quantity||1)));
  const payload={
    data:{
      type:'checkouts',
      attributes:{
        product_options:{
          redirect_url:opts.redirectUrl,
          enabled_variants:[Number(variantId)]
        },
        checkout_options:{
          embed:false,
          media:false,
          logo:true,
          desc:true,
          discount:false,
          skip_trial:true,
          subscription_preview:true
        },
        checkout_data:{
          email:opts.email,
          name:opts.name||undefined,
          billing_address:{country:'RS'},
          custom:{
            organization_id:opts.organizationId,
            user_id:opts.userId,
            plan:opts.plan,
            quantity:String(quantity)
          },
          variant_quantities:[{variant_id:Number(variantId),quantity}]
        },
        test_mode:false
      },
      relationships:{
        store:{data:{type:'stores',id:String(storeId)}},
        variant:{data:{type:'variants',id:String(variantId)}}
      }
    }
  };
  const json=await lsFetch('/checkouts',{method:'POST',body:JSON.stringify(payload)});
  return {
    checkoutId:String(json?.data?.id||''),
    url:String(json?.data?.attributes?.url||'')
  };
}

export async function retrieveSubscription(subscriptionId:string){
  const json=await lsFetch(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
  return json?.data||null;
}

export async function updateSubscriptionQuantity(subscriptionId:string, quantity:number){
  const subscription=await retrieveSubscription(subscriptionId);
  const itemId=String(subscription?.attributes?.first_subscription_item?.id||'');
  if(!itemId) throw new Error('Subscription item za obračun korisnika nije pronađen.');
  const q=Math.max(1,Math.floor(Number(quantity||1)));
  const payload={data:{type:'subscription-items',id:itemId,attributes:{quantity:q,invoice_immediately:false,disable_prorations:false}}};
  const json=await lsFetch(`/subscription-items/${encodeURIComponent(itemId)}`,{method:'PATCH',body:JSON.stringify(payload)});
  return json?.data||null;
}

export function providerStatusHasAccess(status:string, endsAt?:string|null){
  if(['active','paused','past_due','on_trial'].includes(status)) return true;
  if(status==='cancelled' && endsAt) return new Date(endsAt).getTime()>Date.now();
  return false;
}
