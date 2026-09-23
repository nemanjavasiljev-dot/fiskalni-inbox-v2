import { NextResponse } from 'next/server';
import { requireMaster } from '@/lib/master-auth';
import { settleProforma } from '@/lib/billing';

export async function POST(request:Request){
  const ctx=await requireMaster();if(!ctx.ok)return NextResponse.json({error:ctx.error},{status:ctx.status});
  const body=await request.json().catch(()=>({}));const transactionId=String(body.transaction_id||'');const proformaId=String(body.proforma_id||'');
  if(!transactionId||!proformaId)return NextResponse.json({error:'Nedostaje transakcija ili predračun.'},{status:400});
  const [{data:tx},{data:proforma}]=await Promise.all([
    ctx.admin.from('bank_transactions').select('*').eq('id',transactionId).maybeSingle(),
    ctx.admin.from('billing_invoices').select('*').eq('id',proformaId).maybeSingle()
  ]);
  if(!tx||!proforma)return NextResponse.json({error:'Transakcija ili predračun nisu pronađeni.'},{status:404});
  if(tx.status==='matched')return NextResponse.json({error:'Ova bankarska transakcija je već rasknjižena.'},{status:409});
  if(tx.direction!=='credit')return NextResponse.json({error:'Samo prilivna transakcija može da verifikuje uplatu korisnika.'},{status:409});
  if(proforma.document_type!=='proforma'||proforma.status!=='unpaid')return NextResponse.json({error:'Predračun nije otvoren za naplatu.'},{status:409});
  if(String(tx.currency||'RSD').toUpperCase()!=='RSD'||Math.abs(Number(tx.amount||0)-Number(proforma.total_amount||0))>=0.01)return NextResponse.json({error:'Iznos transakcije ne odgovara iznosu predračuna.'},{status:409});
  try{
    const result=await settleProforma({admin:ctx.admin,proformaId,bankTransactionId:transactionId,verifiedBy:ctx.user.id,verificationSource:'MASTER_BANK_MATCH',paidAt:tx.booked_at||new Date().toISOString(),appBillingUrl:`${new URL(request.url).origin}/app/billing`});
    return NextResponse.json({ok:true,invoice:result.invoice,message:'Uplata je verifikovana, finalni račun je izdat i pretplata aktivirana.'});
  }catch(e:any){return NextResponse.json({error:e?.message||'Rasknjižavanje nije uspelo.'},{status:400});}
}
