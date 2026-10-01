import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createPlanProforma, nextMonthlyOccurrence } from '@/lib/billing';

export async function GET(request:Request){
  const secret=process.env.CRON_SECRET;
  if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`){
    return NextResponse.json({error:'Unauthorized'},{status:401});
  }

  const admin=createAdminClient();
  const today=new Date().toISOString().slice(0,10);
  const {data:subscriptions,error}=await admin.from('subscriptions')
    .select('organization_id,plan,seat_count,first_paid_at,billing_anchor_day,next_proforma_at,auto_proforma_enabled')
    .eq('auto_proforma_enabled',true)
    .not('next_proforma_at','is',null)
    .lte('next_proforma_at',today)
    .order('next_proforma_at',{ascending:true})
    .limit(500);
  if(error)return NextResponse.json({error:error.message},{status:500});

  let issued=0;let emailed=0;let skipped=0;
  const errors:any[]=[];
  for(const sub of subscriptions||[]){
    const {data:org}=await admin.from('organizations').select('id,company_id,name,pib,registration_number,address,contact_email,owner_user_id,organization_type,status').eq('id',sub.organization_id).maybeSingle();
    if(!org||org.organization_type==='accounting'||['paused','cancelled'].includes(String(org.status||''))){skipped+=1;continue;}

    let recipientEmail=String(org.contact_email||'').trim();
    if(!recipientEmail&&org.owner_user_id){
      const {data:profile}=await admin.from('profiles').select('auth_email').eq('user_id',org.owner_user_id).maybeSingle();
      recipientEmail=String(profile?.auth_email||'').trim();
    }
    const cycleOn=String(sub.next_proforma_at).slice(0,10);
    try{
      const created=await createPlanProforma({
        admin,organization:org,plan:sub.plan==='premium'?'premium':'basic',seats:Math.max(1,Number(sub.seat_count||1)),
        recipientEmail,appBillingUrl:`${new URL(request.url).origin}/app/billing`,billingCycleOn:cycleOn,recurring:true,resendExisting:true
      });
      if(created.invoice)issued+=created.reused?0:1;
      if(created.email?.sent)emailed+=1;
      if(!recipientEmail||!created.email?.sent){
        errors.push({organization_id:org.id,cycle_on:cycleOn,error:!recipientEmail?'Klijent nema email za slanje predračuna.':'Predračun je kreiran, ali email nije poslat.'});
        // Ne pomeramo ciklus: sledeći dnevni cron ponovo pokušava slanje istog, idempotentnog predračuna.
        continue;
      }
      const anchor=Number(sub.billing_anchor_day||new Date(sub.first_paid_at||`${cycleOn}T00:00:00Z`).getUTCDate()||1);
      const next=nextMonthlyOccurrence(anchor,`${cycleOn}T12:00:00Z`);
      await admin.from('subscriptions').update({
        next_proforma_at:next,
        last_auto_proforma_at:new Date().toISOString(),
        last_auto_proforma_id:created.invoice?.id||null
      }).eq('organization_id',sub.organization_id);
    }catch(e:any){
      errors.push({organization_id:sub.organization_id,cycle_on:cycleOn,error:String(e?.message||e).slice(0,300)});
    }
  }

  return NextResponse.json({ok:true,date:today,due:(subscriptions||[]).length,issued,emailed,skipped,errors:errors.slice(0,50)});
}
