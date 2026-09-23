import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeEmail, normalizePhone, requestMatchesRecipient } from '@/lib/connection-requests';

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:'Niste prijavljeni.'},{status:401});
  const body=await request.json().catch(()=>({}));
  const decision=body.decision==='reject'?'reject':'approve';
  const organizationId=String(body.organization_id||'');
  const admin=createAdminClient();
  const {data:req}=await admin.from('connection_requests').select('*').eq('id',id).maybeSingle();
  if(!req||req.status!=='pending')return NextResponse.json({error:'Zahtev više nije aktivan.'},{status:410});
  if(req.expires_at&&new Date(req.expires_at).getTime()<Date.now()){
    await admin.from('connection_requests').update({status:'expired',updated_at:new Date().toISOString()}).eq('id',id);
    return NextResponse.json({error:'Zahtev je istekao.'},{status:410});
  }

  const {data:profile}=await admin.from('profiles').select('auth_email').eq('user_id',user.id).maybeSingle();
  const {data:members}=await admin.from('organization_members').select('organization_id,role').eq('user_id',user.id).in('role',['owner','employee']);
  const memberIds=(members||[]).map((m:any)=>m.organization_id);
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

  const now=new Date().toISOString();
  if(decision==='reject'){
    await admin.from('connection_requests').update({status:'rejected',target_organization_id:recipientOrg.id,responded_at:now,responded_by:user.id,updated_at:now}).eq('id',id);
    return NextResponse.json({ok:true,message:'Zahtev je odbijen.'});
  }

  const {data:senderOrg}=await admin.from('organizations').select('id,name,organization_type,owner_user_id,company_id').eq('id',req.sender_organization_id).maybeSingle();
  if(!senderOrg)return NextResponse.json({error:'Organizacija pošiljaoca više ne postoji.'},{status:409});
  const senderKind=senderOrg.organization_type==='accounting'?'accounting':'company';
  let accountingOrg:any, companyOrg:any;
  if(senderKind==='accounting'){
    accountingOrg=senderOrg; companyOrg=recipientOrg;
  }else{
    companyOrg=senderOrg; accountingOrg=recipientOrg;
  }
  if(!companyOrg.company_id)return NextResponse.json({error:'Firma nema centralni company_id i ne može da se poveže.'},{status:409});

  const {error:relError}=await admin.from('accountant_company').upsert({
    accountant_organization_id:accountingOrg.id,
    company_id:companyOrg.company_id,
    client_organization_id:companyOrg.id,
    status:'active',
    requested_by:req.sender_user_id||null,
    approved_by:user.id,
    approved_at:now,
    updated_at:now
  },{onConflict:'accountant_organization_id,company_id'});
  if(relError)return NextResponse.json({error:relError.message},{status:400});

  // Omogući da relevantni knjigovođa odmah vidi klijenta u dashboardu.
  const accountantUsers=new Set<string>();
  if(accountingOrg.owner_user_id)accountantUsers.add(String(accountingOrg.owner_user_id));
  if(senderKind==='accounting'&&req.sender_user_id)accountantUsers.add(String(req.sender_user_id));
  if(targetKind==='accounting')accountantUsers.add(String(user.id));
  for(const accountantUserId of accountantUsers){
    await admin.from('organization_members').upsert({organization_id:companyOrg.id,user_id:accountantUserId,role:'accountant'},{onConflict:'organization_id,user_id'});
  }

  await admin.from('connection_requests').update({status:'accepted',target_organization_id:recipientOrg.id,responded_at:now,responded_by:user.id,updated_at:now}).eq('id',id);
  return NextResponse.json({ok:true,message:'Zahtev je prihvaćen. Povezivanje je aktivno.'});
}
