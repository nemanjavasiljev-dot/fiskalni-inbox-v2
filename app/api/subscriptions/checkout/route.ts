import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createPlanProforma } from '@/lib/billing';

export async function POST(request:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:'Niste prijavljeni.'},{status:401});
  const body=await request.json().catch(()=>({}));
  const organizationId=String(body.organization_id||'');const plan=body.plan==='premium'?'premium':'basic';
  if(!organizationId)return NextResponse.json({error:'Nedostaje organizacija.'},{status:400});
  const admin=createAdminClient();
  const {data:org}=await admin.from('organizations').select('id,company_id,name,pib,registration_number,address,owner_user_id,organization_type,status,contact_email').eq('id',organizationId).maybeSingle();
  if(!org)return NextResponse.json({error:'Organizacija nije pronađena.'},{status:404});
  const {data:membership}=await admin.from('organization_members').select('role,accounting_access_role').eq('organization_id',organizationId).eq('user_id',user.id).maybeSingle();
  const allowed=org.owner_user_id===user.id||(org.organization_type==='accounting'&&membership?.role==='employee'&&membership?.accounting_access_role==='admin');
  if(!allowed)return NextResponse.json({error:'Samo administrator naloga može izabrati pretplatu.'},{status:403});
  const {data:subscription}=await admin.from('subscriptions').select('*').eq('organization_id',organizationId).maybeSingle();
  if(subscription?.status==='active'&&new Date(subscription?.current_period_end||0).getTime()>Date.now())return NextResponse.json({error:'Pretplata je već aktivna.'},{status:409});
  const {count}=await admin.from('organization_members').select('id',{count:'exact',head:true}).eq('organization_id',organizationId).in('role',['owner','employee']);
  const seats=Math.max(1,Number(count||1));
  const recipientEmail=String(org.contact_email||user.email||'').trim();
  if(!recipientEmail)return NextResponse.json({error:'Na nalogu nema email adrese na koju možemo poslati predračun.'},{status:409});
  try{
    const result=await createPlanProforma({admin,organization:org,plan,seats,recipientEmail,appBillingUrl:`${new URL(request.url).origin}/app/billing`});
    const trialStillActive=subscription?.status==='trial'&&subscription?.trial_ends_at&&new Date(subscription.trial_ends_at).getTime()>Date.now();
    const subUpdate:any={plan,seat_count:seats,provider:'bank_transfer',provider_status:'awaiting_bank_payment',checkout_started_at:new Date().toISOString()};
    if(!trialStillActive)subUpdate.status='unpaid';
    await admin.from('subscriptions').update(subUpdate).eq('organization_id',organizationId);
    await admin.from('organizations').update({plan,...(!trialStillActive?{status:'pending_payment'}:{})}).eq('id',organizationId);
    const mailSent=Boolean(result.email?.sent);
    return NextResponse.json({ok:true,invoice_id:result.invoice?.id,reused:result.reused,url:`/app/files?org=${organizationId}&tab=billing`,email_sent:mailSent,message:result.reused?(mailSent?'Postojeći predračun je ponovo poslat na email.':'Postojeći predračun je spreman u Fajlovi → Računi / predračuni, ali email nije poslat. Proverite Resend konfiguraciju.'):(mailSent?'Predračun je kreiran, dodat u Fajlovi → Računi / predračuni i poslat na email firme.':'Predračun je kreiran i dodat u Fajlovi → Računi / predračuni, ali email nije poslat. Proverite Resend konfiguraciju.')});
  }catch(e:any){return NextResponse.json({error:e?.message||'Predračun nije mogao da se kreira.'},{status:400});}
}
