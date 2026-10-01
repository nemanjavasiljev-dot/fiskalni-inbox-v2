import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const MAX=15*1024*1024;
const ALLOWED=new Set(['image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif']);
function ext(file:File){
  const byName=String(file.name||'').split('.').pop()?.toLowerCase();
  if(byName&&/^[a-z0-9]{2,5}$/.test(byName))return byName;
  return file.type==='image/png'?'png':file.type==='image/webp'?'webp':file.type==='image/heic'?'heic':file.type==='image/heif'?'heif':'jpg';
}

export async function POST(request:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:'Niste prijavljeni.'},{status:401});
  const form=await request.formData();
  const organizationId=String(form.get('organization_id')||'');
  const file=form.get('file');
  if(!organizationId||!(file instanceof File))return NextResponse.json({error:'Nedostaje fotografija fiskalnog računa.'},{status:400});
  if(!ALLOWED.has(file.type))return NextResponse.json({error:'Fotografija mora biti JPG, PNG, WEBP ili HEIC/HEIF.'},{status:400});
  if(file.size<=0||file.size>MAX)return NextResponse.json({error:'Fotografija može imati najviše 15 MB.'},{status:400});

  const {data:allowed,error:accessError}=await supabase.rpc('can_manage_org_documents',{org:organizationId});
  if(accessError||!allowed)return NextResponse.json({error:'Nemate pravo dodavanja računa za ovu firmu.'},{status:403});

  const admin=createAdminClient();
  const {data:org}=await admin.from('organizations').select('id,name,pib,registration_number,address,municipality,activity_code,activity_name').eq('id',organizationId).maybeSingle();
  if(!org)return NextResponse.json({error:'Firma nije pronađena.'},{status:404});

  const id=randomUUID();
  const day=new Date().toISOString().slice(0,10);
  const path=`${organizationId}/${day}/${id}.${ext(file)}`;
  const bytes=Buffer.from(await file.arrayBuffer());
  const upload=await admin.storage.from('receipt-images').upload(path,bytes,{contentType:file.type,upsert:false});
  if(upload.error)return NextResponse.json({error:'Fotografija nije sačuvana.'},{status:500});

  const qrUrl=`photo://${id}`;
  const {data:receipt,error}=await admin.from('receipts').insert({
    id,
    organization_id:organizationId,
    created_by:user.id,
    qr_url:qrUrl,
    receipt_source:'photo',
    source_image_path:path,
    source_image_name:String(file.name||'fiskalni-racun'),
    source_image_mime:file.type,
    buyer_pib:org.pib||null,
    buyer_name:org.name||null,
    buyer_registration_number:org.registration_number||null,
    buyer_address:org.address||null,
    buyer_city:org.municipality||null,
    buyer_pib_status:org.pib?'present':'missing',
    saved_without_buyer_pib:!org.pib,
    bookkeeping_eligible:false,
    category:'Ostalo',
    category_source:'photo_fallback',
    verification_status:'fotografija_za_proveru',
    note:'QR kod nije moguće pročitati. Sačuvana je fotografija celog fiskalnog računa za ručnu proveru.',
    raw_json:{source:'photo_fallback',reason:'qr_unreadable',captured_at:new Date().toISOString()}
  }).select('*').single();
  if(error){await admin.storage.from('receipt-images').remove([path]);return NextResponse.json({error:'Fiskalni račun nije upisan u bazu.'},{status:400});}
  return NextResponse.json({ok:true,id:receipt.id,receipt,message:'Fotografija je sačuvana među fiskalnim računima.'});
}
