import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildAccountantArchive } from '@/lib/accountant-download';

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:'Niste prijavljeni.'},{status:401});const {id}=await params;
  const {data:member}=await supabase.from('organization_members').select('id').eq('organization_id',id).eq('user_id',user.id).eq('role','accountant').maybeSingle();if(!member)return NextResponse.json({error:'Nemate pristup ovom klijentu.'},{status:403});
  const url=new URL(request.url);const type=url.searchParams.get('type')==='documents'?'documents':'receipts';const month=url.searchParams.get('month')||new Date().toISOString().slice(0,7);
  try{const {content,count}=await buildAccountantArchive({admin:createAdminClient(),accountantUserId:user.id,organizationIds:[id],type,month});const label=type==='receipts'?'racuni':'dokumenti';return new Response(new Uint8Array(content),{headers:{'Content-Type':'application/zip','Content-Disposition':`attachment; filename="FiscalBox_${label}_${month}.zip"`,'X-FiscalBox-Count':String(count),'Cache-Control':'private, no-store'}});}catch(e:any){return NextResponse.json({error:e?.message||'Arhiva nije mogla da se pripremi.'},{status:400});}
}
