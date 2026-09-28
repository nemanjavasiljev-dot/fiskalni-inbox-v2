import { NextResponse } from 'next/server';
import { requireMaster } from '@/lib/master-auth';
import { nextMonthlyOccurrence } from '@/lib/billing';

export async function POST(request:Request){
  const ctx=await requireMaster();if(!ctx.ok)return NextResponse.json({error:ctx.error},{status:ctx.status});
  const body=await request.json().catch(()=>({}));
  const organizationId=String(body.organization_id||'');
  const enabled=body.enabled===true;
  if(!organizationId)return NextResponse.json({error:'Nedostaje organizacija.'},{status:400});
  const {data:org}=await ctx.admin.from('organizations').select('id,name,organization_type').eq('id',organizationId).maybeSingle();
  if(!org||org.organization_type==='accounting')return NextResponse.json({error:'Automatski predračuni se podešavaju samo za klijente/firme.'},{status:400});
  const {data:sub}=await ctx.admin.from('subscriptions').select('*').eq('organization_id',organizationId).maybeSingle();
  if(!sub)return NextResponse.json({error:'Klijent nema zapis pretplate.'},{status:404});

  let next=sub.next_proforma_at||null;
  const firstPaidAt=sub.first_paid_at||sub.activated_at||sub.last_payment_at||null;
  let anchor=Number(sub.billing_anchor_day||0)||null;
  if(enabled&&firstPaidAt){
    anchor=anchor||new Date(firstPaidAt).getUTCDate();
    const today=new Date().toISOString().slice(0,10);
    if(!next||String(next).slice(0,10)<today)next=nextMonthlyOccurrence(anchor,new Date());
  }
  const payload:any={auto_proforma_enabled:enabled};
  if(anchor)payload.billing_anchor_day=anchor;
  if(enabled)payload.next_proforma_at=next;
  const {error}=await ctx.admin.from('subscriptions').update(payload).eq('organization_id',organizationId);
  if(error)return NextResponse.json({error:error.message},{status:400});
  await ctx.admin.from('master_action_log').insert({action:enabled?'auto_proforma_enabled':'auto_proforma_disabled',organization_id:organizationId,details:{next_proforma_at:next},created_by:ctx.user.id});
  return NextResponse.json({ok:true,enabled,next_proforma_at:next,message:enabled?(next?`Automatsko slanje je aktivirano. Sledeći predračun: ${next}.`:'Automatsko slanje je aktivirano i čeka prvu potvrđenu uplatu.'):'Automatsko slanje predračuna je zaustavljeno.'});
}
