import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeBankTransaction, storeTransaction, tryAutoMatch } from '@/lib/bank-reconciliation';

export async function POST(request:Request){
  const expected=process.env.BANK_WEBHOOK_SECRET;
  if(!expected||request.headers.get('x-fiscalbox-bank-secret')!==expected)return NextResponse.json({error:'Unauthorized'},{status:401});
  const body=await request.json().catch(()=>null);if(!body)return NextResponse.json({error:'Invalid payload'},{status:400});
  const admin=createAdminClient();const rows=Array.isArray(body)?body:Array.isArray(body.transactions)?body.transactions:[body];let accepted=0,matched=0;
  for(const raw of rows){const tx=normalizeBankTransaction(raw,process.env.BANK_PROVIDER||'bank_webhook');if(!tx||tx.direction!=='credit')continue;const saved=await storeTransaction(admin,tx);accepted++;const result=await tryAutoMatch(admin,saved,null,`${new URL(request.url).origin}/app/billing`);if(result.matched)matched++;}
  return NextResponse.json({ok:true,accepted,matched});
}
