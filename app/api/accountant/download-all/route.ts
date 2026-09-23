import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildAccountantArchive } from '@/lib/accountant-download';

export async function GET(request:Request){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:'Niste prijavljeni.'},{status:401});
  const url=new URL(request.url);const type=url.searchParams.get('type')==='documents'?'documents':'receipts';const month=url.searchParams.get('month')||new Date().toISOString().slice(0,7);
  const {data:members}=await supabase.from('organization_members').select('organization_id').eq('user_id',user.id).eq('role','accountant');const ids=(members||[]).map((m:any)=>String(m.organization_id));
  try{const {content,count}=await buildAccountantArchive({admin:createAdminClient(),accountantUserId:user.id,organizationIds:ids,type,month});const label=type==='receipts'?'racuni':'dokumenti';return new Response(new Uint8Array(content),{headers:{'Content-Type':'application/zip','Content-Disposition':`attachment; filename="FiscalBox_${label}_${month}.zip"`,'X-FiscalBox-Count':String(count),'Cache-Control':'private, no-store'}});}catch(e:any){return NextResponse.json({error:e?.message||'Arhiva nije mogla da se pripremi.'},{status:400});}
}
