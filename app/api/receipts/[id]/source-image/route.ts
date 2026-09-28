import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:'Niste prijavljeni.'},{status:401});
  const {id}=await params;
  // RLS na receipts proverava da li trenutni korisnik sme da vidi ovaj fiskalni račun.
  const {data:receipt}=await supabase.from('receipts').select('id,receipt_source,source_image_path,source_image_mime').eq('id',id).maybeSingle();
  if(!receipt?.source_image_path)return NextResponse.json({error:'Fotografija nije dostupna.'},{status:404});
  const admin=createAdminClient();
  const {data,error}=await admin.storage.from('receipt-images').download(receipt.source_image_path);
  if(error||!data)return NextResponse.json({error:'Fotografija nije dostupna.'},{status:404});
  const bytes=await data.arrayBuffer();
  return new Response(bytes,{headers:{'Content-Type':receipt.source_image_mime||data.type||'image/jpeg','Cache-Control':'private, max-age=300'}});
}
