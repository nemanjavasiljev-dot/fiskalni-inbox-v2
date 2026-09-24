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
  const decision=body.decision;
  if(!['approve','reject'].includes(decision))return NextResponse.json({error:'Nepoznata odluka.'},{status:400});
  const organizationId=String(body.organization_id||'');
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
  const {error}=await admin.rpc('respond_connection_request',{
    p_request:id,p_actor:user.id,p_recipient:recipientOrg.id,p_decision:decision
  });
  if(error)return NextResponse.json({error:'Zahtev nije obrađen. Osvežite stranicu i pokušajte ponovo.'},{status:409});
  return NextResponse.json({ok:true,message:decision==='approve'?'Povezivanje je odobreno.':'Zahtev je odbijen.'});
}
