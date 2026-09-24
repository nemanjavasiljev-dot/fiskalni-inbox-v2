import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedFiscalUrl, normalizeVerification } from "@/lib/fiscal";
import { classifyReceiptCategory } from "@/lib/receipt-category";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data:{ user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({error:"Niste prijavljeni."},{status:401});

  const body = await request.json();
  const organizationId = String(body.organization_id || "");
  const qrUrl = String(body.qr_url || "").trim();
  if (!organizationId || !qrUrl) return NextResponse.json({error:"Nedostaju podaci."},{status:400});
  if (!isAllowedFiscalUrl(qrUrl)) return NextResponse.json({error:"QR ne vodi na dozvoljeni domen Poreske uprave."},{status:400});

  const {data:allowed,error:accessError}=await supabase.rpc('can_manage_org_documents',{org:organizationId});
  if(accessError||!allowed)return NextResponse.json({error:'Nemate pravo dodavanja računa za ovu firmu.'},{status:403});

  const { data: existing } = await supabase.from("receipts").select("*").eq("organization_id",organizationId).eq("qr_url",qrUrl).maybeSingle();
  if (existing) return NextResponse.json({duplicate:true,id:existing.id,receipt:existing});

  let raw:any = {};
  let normalized:any = {};
  let status = "provera_neuspela";
  try {
    const vr = await fetch(qrUrl,{redirect:"error",headers:{Accept:"application/json"},cache:"no-store",signal:AbortSignal.timeout(12000)});
    const text = await vr.text();
    if (!vr.ok) throw new Error(`HTTP ${vr.status}`);
    raw = JSON.parse(text);
    normalized = normalizeVerification(raw);
    status = normalized.verification_valid === false ? "nevalidan" : normalized.verification_valid === true ? "provereno" : "provera_neuspela";
  } catch(e:any) {
    raw = { verificationError:e?.message || "Provera nije uspela." };
  }

  const classification = classifyReceiptCategory(raw, normalized.merchant_name || null);
  const { data, error } = await supabase.from("receipts").insert({
    organization_id:organizationId,
    created_by:user.id,
    qr_url:qrUrl,
    merchant_name:normalized.merchant_name || null,
    merchant_pib:normalized.merchant_pib || null,
    invoice_number:normalized.invoice_number || null,
    sdc_time:normalized.sdc_time || null,
    total_amount:normalized.total_amount ?? null,
    total_tax:normalized.total_tax ?? null,
    payment_method:normalized.payment_method || null,
    buyer_pib:normalized.buyer_pib || null,
    category:classification.category,
    category_source:classification.source,
    category_confidence:classification.confidence,
    verification_status:status,
    raw_json:raw
  }).select("*").single();

  if(error?.code==='23505'){
    const {data:duplicate}=await supabase.from('receipts').select('*').eq('organization_id',organizationId).eq('qr_url',qrUrl).maybeSingle();
    if(duplicate)return NextResponse.json({duplicate:true,id:duplicate.id,receipt:duplicate});
  }
  if (error) return NextResponse.json({error:'Račun nije sačuvan. Pokušajte ponovo.'},{status:400});
  return NextResponse.json({duplicate:false,id:data.id,status,receipt:data,classification});
}
