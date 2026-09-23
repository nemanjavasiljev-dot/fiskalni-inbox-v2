import { NextResponse } from 'next/server';
import { requireMaster } from '@/lib/master-auth';
import { syncBankTransactions } from '@/lib/bank-reconciliation';

export async function POST(request:Request){
  const ctx=await requireMaster();if(!ctx.ok)return NextResponse.json({error:ctx.error},{status:ctx.status});
  try{
    const result=await syncBankTransactions(ctx.admin,ctx.user.id,`${new URL(request.url).origin}/app/billing`);
    if(!result.configured)return NextResponse.json({error:'Bankarski API još nije podešen. Potrebni su BANK_API_URL i BANK_API_TOKEN za konkretnu banku/provider.'},{status:503});
    return NextResponse.json({ok:true,...result,message:`Banka osvežena: ${result.seen} transakcija, ${result.matched} automatski rasknjiženo.`});
  }catch(e:any){return NextResponse.json({error:e?.message||'Sinhronizacija sa bankom nije uspela.'},{status:502});}
}
