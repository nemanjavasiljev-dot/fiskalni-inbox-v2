import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedFiscalUrl, normalizeVerification, extractBuyerPib } from "@/lib/fiscal";
import { classifyReceiptCategory } from "@/lib/receipt-category";
import { createAdminClient } from "@/lib/supabase/admin";
import { lookupCompanyByPib } from "@/lib/company-registry/company-registry-service";
import { detectWarrantyCandidate } from "@/lib/warranty";

async function resolveBuyer(pib:string){
  const admin=createAdminClient();
  const {data:orgBuyer}=await admin.from("organizations")
    .select("name,pib,registration_number,address,municipality")
    .eq("pib",pib).limit(1).maybeSingle();
  if(orgBuyer)return {name:orgBuyer.name,registration_number:orgBuyer.registration_number,address:orgBuyer.address,city:orgBuyer.municipality,source:"FiscalBox profil"};
  try{
    const resolved=await lookupCompanyByPib(pib);
    return {...resolved.company,source:resolved.source};
  }catch(e:any){
    console.warn("[FiscalBox receipt] buyer PIB lookup failed",{pib,error:String(e?.message||e).slice(0,180)});
    return null;
  }
}

function buyerPatch(pib:string,buyer:any){
  return {
    buyer_pib:pib,
    buyer_name:buyer?.name || null,
    buyer_registration_number:buyer?.registration_number || null,
    buyer_address:buyer?.address || null,
    buyer_city:buyer?.city || buyer?.municipality || null,
    buyer_registry_source:buyer?.source || null,
  };
}

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
  if (existing) {
    const existingNormalized=normalizeVerification(existing.raw_json||{});
    const existingPib=existingNormalized.buyer_pib || extractBuyerPib(existing.raw_json||{}) || existing.buyer_pib || null;
    if(existingPib && (!existing.buyer_pib || !existing.buyer_name)){
      const buyer=await resolveBuyer(existingPib);
      const {data:updated}=await supabase.from("receipts").update(buyerPatch(existingPib,buyer)).eq("id",existing.id).select("*").single();
      if(updated)return NextResponse.json({duplicate:true,id:updated.id,receipt:updated});
    }
    return NextResponse.json({duplicate:true,id:existing.id,receipt:existing});
  }

  let raw:any = {};
  let normalized:any = {};
  let status = "provera_neuspela";
  try {
    const vr = await fetch(qrUrl,{redirect:"error",headers:{Accept:"application/json"},cache:"no-store",signal:AbortSignal.timeout(12000)});
    const text = await vr.text();
    if (!vr.ok) throw new Error(`HTTP ${vr.status}`);
    try{ raw = JSON.parse(text); }
    catch{ raw = {verificationPage:text.slice(0,1_500_000)}; }
    normalized = normalizeVerification(raw);
    status = normalized.verification_valid === false ? "nevalidan" : normalized.verification_valid === true ? "provereno" : "provera_neuspela";
  } catch(e:any) {
    raw = { verificationError:e?.message || "Provera nije uspela." };
  }

  const classification = classifyReceiptCategory(raw, normalized.merchant_name || null);
  const warranty = detectWarrantyCandidate(raw, normalized.merchant_name || null, classification.category);
  const buyerPib=normalized.buyer_pib || extractBuyerPib(raw) || null;
  const buyer=buyerPib?await resolveBuyer(buyerPib):null;

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
    ...(buyerPib?buyerPatch(buyerPib,buyer):{}),
    category:classification.category,
    category_source:classification.source,
    category_confidence:classification.confidence,
    warranty_archived_at:warranty.candidate?new Date().toISOString():null,
    warranty_source:warranty.candidate?"auto_heuristic":null,
    warranty_note:warranty.candidate?warranty.reason:null,
    verification_status:status,
    raw_json:raw
  }).select("*").single();

  if(error?.code==='23505'){
    const {data:duplicate}=await supabase.from('receipts').select('*').eq('organization_id',organizationId).eq('qr_url',qrUrl).maybeSingle();
    if(duplicate)return NextResponse.json({duplicate:true,id:duplicate.id,receipt:duplicate});
  }
  if (error) return NextResponse.json({error:'Račun nije sačuvan. Pokušajte ponovo.'},{status:400});
  return NextResponse.json({duplicate:false,id:data.id,status,receipt:data,classification,warranty});
}
