import { NextResponse } from "next/server";
import { requireMaster } from "@/lib/master-auth";

export async function POST(request:Request){
  const ctx=await requireMaster();if(!ctx.ok)return NextResponse.json({error:ctx.error},{status:ctx.status});
  const body=await request.json();
  const companyName=String(body.company_name||'').trim();const pib=String(body.pib||'').replace(/\D/g,'');
  if(!companyName||pib.length!==9)return NextResponse.json({error:'Naziv izdavaoca i PIB od 9 cifara su obavezni.'},{status:400});
  const isAlset=pib==='115266735';
  const payload={
    company_id:String(body.company_id||'')||null,
    company_name:companyName,
    pib,
    registration_number:String(body.registration_number||'').replace(/\D/g,'')||null,
    address:String(body.address||'').trim()||null,
    email:String(body.email||'').trim()||null,
    bank_account:String(body.bank_account||'').trim()||null,
    vat_rate:isAlset?0:Number(body.vat_rate??0),
    not_in_vat:isAlset?true:Boolean(body.not_in_vat),
    payment_code:String(body.payment_code||'221').replace(/\D/g,'').slice(0,3)||'221',
    is_demo:false,
    active:true,
    note:String(body.note||(isAlset?'Izdavalac nije u sistemu PDV-a. PDV nije obračunat u skladu sa članom 33 Zakona o PDV.':'')).trim()||null,
    updated_at:new Date().toISOString()
  };
  await ctx.admin.from('billing_issuer_settings').update({active:false}).neq('id','00000000-0000-0000-0000-000000000000');
  const id=String(body.id||'');
  const result=id?await ctx.admin.from('billing_issuer_settings').update(payload).eq('id',id).select('*').single():await ctx.admin.from('billing_issuer_settings').insert(payload).select('*').single();
  if(result.error)return NextResponse.json({error:result.error.message},{status:400});
  await ctx.admin.from('master_action_log').insert({action:'billing_issuer_updated',details:{issuer_id:result.data.id,pib},created_by:ctx.user.id});
  return NextResponse.json({ok:true,issuer:result.data,message:'Produkcioni izdavalac je sačuvan.'});
}
