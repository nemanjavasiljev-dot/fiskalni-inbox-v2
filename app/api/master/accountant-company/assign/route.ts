import { NextResponse } from 'next/server';
import { requireMaster } from '@/lib/master-auth';

export async function POST(request:Request){
  const ctx=await requireMaster();if(!ctx.ok)return NextResponse.json({error:ctx.error},{status:ctx.status});
  const body=await request.json();
  const accountingCompanyId=String(body.accounting_company_id||'');
  const clientCompanyId=String(body.client_company_id||'');
  const action=String(body.action||'active');
  if(!accountingCompanyId||!clientCompanyId)return NextResponse.json({error:'Izaberite knjigovodstvenu firmu i klijenta.'},{status:400});
  if(!['active','blocked','rejected'].includes(action))return NextResponse.json({error:'Nepoznat status veze.'},{status:400});
  const [{data:office},{data:client}]=await Promise.all([
    ctx.admin.from('organizations').select('id,name,owner_user_id').eq('company_id',accountingCompanyId).eq('organization_type','accounting').limit(1).maybeSingle(),
    ctx.admin.from('organizations').select('id,name').eq('company_id',clientCompanyId).eq('organization_type','company').limit(1).maybeSingle()
  ]);
  if(!office)return NextResponse.json({error:'Izabrana knjigovodstvena firma nema aktivan FiscalBox nalog.'},{status:404});
  if(!client)return NextResponse.json({error:'Izabrani klijent nema aktivan FiscalBox nalog.'},{status:404});
  const now=new Date().toISOString();
  const {data:relation,error}=await ctx.admin.from('accountant_company').upsert({accountant_organization_id:office.id,company_id:clientCompanyId,client_organization_id:client.id,status:action,requested_by:ctx.user.id,approved_by:action==='active'?ctx.user.id:null,approved_at:action==='active'?now:null,updated_at:now},{onConflict:'accountant_organization_id,company_id'}).select('*').single();
  if(error)return NextResponse.json({error:error.message},{status:400});
  if(action==='active'){
    await ctx.admin.from('organization_members').upsert({organization_id:client.id,user_id:office.owner_user_id,role:'accountant'},{onConflict:'organization_id,user_id'});
  }else{
    await ctx.admin.from('organization_members').delete().eq('organization_id',client.id).eq('user_id',office.owner_user_id).eq('role','accountant');
  }
  await ctx.admin.from('master_action_log').insert({action:'accountant_company_relation_updated',organization_id:client.id,details:{relation_id:relation.id,accounting_company_id:accountingCompanyId,client_company_id:clientCompanyId,status:action},created_by:ctx.user.id});
  return NextResponse.json({ok:true,relation,message:action==='active'?`Firma ${client.name} je dodeljena knjigovođi ${office.name}.`:'Veza je ažurirana.'});
}
