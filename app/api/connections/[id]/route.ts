import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requestMatchesRecipient } from '@/lib/connection-requests';
import { sendPushToOrganization } from '@/lib/push-delivery';
import { createPlanProforma } from '@/lib/billing';

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:'Niste prijavljeni.'},{status:401});
  const body=await request.json().catch(()=>({}));
  const decision=body.decision;
  if(!['approve','reject'].includes(decision))return NextResponse.json({error:'Nepoznata odluka.'},{status:400});
  const organizationId=String(body.organization_id||'');
  const employeeUserId=String(body.employee_user_id||'').trim();
  const admin=createAdminClient();
  const {data:req}=await admin.from('connection_requests').select('*').eq('id',id).maybeSingle();
  if(!req||req.status!=='pending')return NextResponse.json({error:'Zahtev više nije aktivan.'},{status:410});
  if(req.expires_at&&new Date(req.expires_at).getTime()<Date.now()){
    await admin.from('connection_requests').update({status:'expired',updated_at:new Date().toISOString()}).eq('id',id);
    return NextResponse.json({error:'Zahtev je istekao.'},{status:410});
  }

  const {data:profile}=await admin.from('profiles').select('auth_email').eq('user_id',user.id).maybeSingle();
  const {data:members}=await admin.from('organization_members').select('organization_id,role,accounting_access_role').eq('user_id',user.id).in('role',['owner','employee']);
  const memberIds=(members||[]).filter((m:any)=>m.role==='owner'||(m.role==='employee'&&m.accounting_access_role==='admin')).map((m:any)=>m.organization_id);
  let orgs:any[]=[];
  if(memberIds.length){
    const {data}=await admin.from('organizations').select('id,name,organization_type,owner_user_id,company_id,contact_email,contact_phone').in('id',memberIds);
    orgs=data||[];
  }
  const targetKind=req.target_kind==='accounting'?'accounting':'company';
  let recipientOrg=orgs.find((o:any)=>String(o.id)===organizationId && (o.organization_type==='accounting'?'accounting':'company')===targetKind);
  if(!recipientOrg){
    recipientOrg=orgs.find((o:any)=>(o.organization_type==='accounting'?'accounting':'company')===targetKind && requestMatchesRecipient(req,profile?.auth_email||user.email||'',o));
  }
  if(!recipientOrg)return NextResponse.json({error:'Ovaj zahtev nije namenjen vašem nalogu.'},{status:403});
  if(req.target_organization_id && String(req.target_organization_id)!==String(recipientOrg.id))return NextResponse.json({error:'Zahtev je namenjen drugoj organizaciji.'},{status:403});
  if(!req.target_organization_id && !requestMatchesRecipient(req,profile?.auth_email||user.email||'',recipientOrg))return NextResponse.json({error:'Email ili telefon naloga se ne poklapa sa zahtevom.'},{status:403});
  if(!user.email_confirmed_at)return NextResponse.json({error:'Potvrdite email adresu pre prihvatanja zahteva.'},{status:403});

  const {data:rpcResult,error}=await admin.rpc('respond_connection_request_v2',{
    p_request:id,p_actor:user.id,p_recipient:recipientOrg.id,p_decision:decision,p_employee:employeeUserId||null
  });
  if(error)return NextResponse.json({error:error.message||'Zahtev nije obrađen. Osvežite stranicu i pokušajte ponovo.'},{status:409});
  const assignedTo=rpcResult?.assigned_to||employeeUserId||null;

  let billingMessage='';
  if(decision==='approve'&&req.sender_kind==='accounting'&&req.target_kind==='company'&&(req.requested_plan==='basic'||req.requested_plan==='premium')){
    const requestedPlan=req.requested_plan;
    const {data:sub}=await admin.from('subscriptions').select('*').eq('organization_id',recipientOrg.id).maybeSingle();
    const validUntil=sub?.current_period_end||sub?.renews_at||sub?.trial_ends_at;
    const currentlyPaid=String(sub?.status||'')==='active'&&validUntil&&new Date(validUntil).getTime()>Date.now();
    if(sub){
      await admin.from('subscriptions').update({plan:requestedPlan,auto_proforma_enabled:true}).eq('organization_id',recipientOrg.id);
    }else{
      await admin.from('subscriptions').insert({organization_id:recipientOrg.id,company_id:recipientOrg.company_id||null,plan:requestedPlan,seat_count:1,status:'pending_checkout',auto_proforma_enabled:true});
    }
    await admin.from('organizations').update({plan:requestedPlan}).eq('id',recipientOrg.id);
    if(!currentlyPaid){
      try{
        const recipientEmail=String(recipientOrg.contact_email||profile?.auth_email||user.email||'');
        const created=await createPlanProforma({admin,organization:recipientOrg,plan:requestedPlan,seats:1,recipientEmail,appBillingUrl:`${new URL(request.url).origin}/app/billing`});
        billingMessage=created.invoice?' Predračun za izabrani paket je kreiran.':'';
      }catch(e:any){
        console.error('[FiscalBox connection] automatic proforma failed',e?.message||e);
        billingMessage=' Povezivanje je uspešno, ali predračun nije automatski kreiran; proverite MASTER naplatu.';
      }
    }
  }

  await sendPushToOrganization(admin,String(req.sender_organization_id),{
    title:decision==='approve'?'Zahtev prihvaćen':'Zahtev odbijen',
    body:`${recipientOrg.name||'Primalac'} je ${decision==='approve'?'prihvatio':'odbio'} zahtev za povezivanje.`,
    url:'/app',tag:`connection-response-${id}`,notificationType:'connection_response'
  }).catch(()=>{});
  return NextResponse.json({ok:true,assigned_to:assignedTo,message:decision==='approve'?((assignedTo?'Klijent je prihvaćen i dodeljen zaposlenom.':'Klijent je prihvaćen i ostavljen kod ADMIN knjigovođe.')+billingMessage):'Zahtev je odbijen.'});
}
