import { NextResponse } from 'next/server';
import { requireMaster } from '@/lib/master-auth';
import { settleProforma } from '@/lib/billing';

export async function POST(request:Request){
  const ctx=await requireMaster();if(!ctx.ok)return NextResponse.json({error:ctx.error},{status:ctx.status});
  const {id,status}=await request.json();
  if(!id||!["paid","unpaid","cancelled"].includes(status))return NextResponse.json({error:'Neispravan status.'},{status:400});
  const {data:doc}=await ctx.admin.from('billing_invoices').select('*').eq('id',id).maybeSingle();
  if(!doc)return NextResponse.json({error:'Dokument nije pronađen.'},{status:404});
  if(status==='paid'&&doc.document_type==='proforma'){
    try{
      const settled=await settleProforma({admin:ctx.admin,proformaId:String(doc.id),verifiedBy:ctx.user.id,verificationSource:'MASTER_RUČNA_VERIFIKACIJA',paidAt:new Date().toISOString(),appBillingUrl:`${new URL(request.url).origin}/app/billing`});
      return NextResponse.json({ok:true,invoice:settled.invoice,message:'Uplata verifikovana. Finalni račun je izdat i poslat klijentu.'});
    }catch(e:any){return NextResponse.json({error:e?.message||'Verifikacija uplate nije uspela.'},{status:400});}
  }
  const {error}=await ctx.admin.from('billing_invoices').update({status,paid_at:status==='paid'?new Date().toISOString():null}).eq('id',id);
  if(error)return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({ok:true,message:'Status dokumenta je sačuvan.'});
}
