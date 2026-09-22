import { NextResponse } from 'next/server';
import { aprLookup } from '@/lib/apr';

export async function POST(request:Request){
  const {query}=await request.json();
  try { return NextResponse.json(await aprLookup(query)); }
  catch(e:any){ return NextResponse.json({error:e?.message||'APR servis trenutno nije dostupan.',configured:e?.code!=='APR_NOT_CONFIGURED'},{status:e?.code==='APR_NOT_CONFIGURED'?503:502}); }
}
