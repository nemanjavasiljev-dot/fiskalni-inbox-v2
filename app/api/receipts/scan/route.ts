import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedFiscalUrl, normalizeVerification, extractBuyerPib } from "@/lib/fiscal";
import { classifyReceiptCategory } from "@/lib/receipt-category";
import { createAdminClient } from "@/lib/supabase/admin";
import { lookupCompanyByPib } from "@/lib/company-registry/company-registry-service";
import { detectWarrantyCandidate } from "@/lib/warranty";
import { ensureVatAiAnalysis } from "@/lib/vat-ai";

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

function canonicalQr(raw:string){
  try{
    const u=new URL(raw.trim());
    u.hash="";
    const sorted=new URLSearchParams();
    Array.from(u.searchParams.entries()).sort(([a,av],[b,bv])=>a.localeCompare(b)||av.localeCompare(bv)).forEach(([k,v])=>sorted.append(k,v));
    u.search=sorted.toString();
    u.hostname=u.hostname.toLowerCase();
    return u.toString();
  }catch{return raw.trim();}
}

function token(v:unknown){return String(v??"").trim().toUpperCase().replace(/\s+/g,"");}
function digits(v:unknown){return String(v??"").replace(/\D/g,"");}

function receiptFingerprint(normalized:any,qrUrl:string){
  const merchant=digits(normalized?.merchant_pib);
  const invoice=token(normalized?.invoice_number);
  const sdc=normalized?.sdc_time ? new Date(normalized.sdc_time).toISOString().replace(/\.\d{3}Z$/,"Z") : "";
  if(invoice && (merchant || sdc)) return `v1:${merchant||"-"}|${invoice}|${sdc||"-"}`;
  return `qr:${canonicalQr(qrUrl)}`;
}

async function findDuplicate(supabase:any,organizationId:string,qrUrl:string,fingerprint?:string|null){
  const byQr=await supabase.from("receipts").select("*").eq("organization_id",organizationId).eq("qr_url",qrUrl).maybeSingle();
  if(byQr.data)return byQr.data;
  if(fingerprint){
    const byFingerprint=await supabase.from("receipts").select("*").eq("organization_id",organizationId).eq("receipt_fingerprint",fingerprint).maybeSingle();
    if(byFingerprint.data)return byFingerprint.data;
  }
  return null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data:{ user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({error:"Niste prijavljeni."},{status:401});

  const body = await request.json();
  const organizationId = String(body.organization_id || "");
  const qrUrl = String(body.qr_url || "").trim();
  const confirmWithoutBuyerPib = body.confirm_without_buyer_pib === true;
  if (!organizationId || !qrUrl) return NextResponse.json({error:"Nedostaju podaci."},{status:400});
  if (!isAllowedFiscalUrl(qrUrl)) return NextResponse.json({error:"QR ne vodi na dozvoljeni domen Poreske uprave."},{status:400});

  const {data:allowed,error:accessError}=await supabase.rpc('can_manage_org_documents',{org:organizationId});
  if(accessError||!allowed)return NextResponse.json({error:'Nemate pravo dodavanja računa za ovu firmu.'},{status:403});

  const existingByQr = await findDuplicate(supabase,organizationId,qrUrl,null);
  if (existingByQr) {
    const existingNormalized=normalizeVerification(existingByQr.raw_json||{});
    const existingPib=existingNormalized.buyer_pib || extractBuyerPib(existingByQr.raw_json||{}) || existingByQr.buyer_pib || null;
    if(existingPib && (!existingByQr.buyer_pib || !existingByQr.buyer_name)){
      const buyer=await resolveBuyer(existingPib);
      const {data:updated}=await supabase.from("receipts").update({...buyerPatch(existingPib,buyer),buyer_pib_status:"present",bookkeeping_eligible:true}).eq("id",existingByQr.id).select("*").single();
      if(updated)return NextResponse.json({duplicate:true,message:"Ovaj račun je već skeniran.",id:updated.id,receipt:updated});
    }
    return NextResponse.json({duplicate:true,message:"Ovaj račun je već skeniran.",id:existingByQr.id,receipt:existingByQr});
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
    normalized = normalizeVerification(raw);
  }

  const fingerprint=receiptFingerprint(normalized,qrUrl);
  const duplicate=await findDuplicate(supabase,organizationId,qrUrl,fingerprint);
  if(duplicate)return NextResponse.json({duplicate:true,message:"Ovaj račun je već skeniran.",id:duplicate.id,receipt:duplicate});

  const classification = classifyReceiptCategory(raw, normalized.merchant_name || null);
  const warranty = detectWarrantyCandidate(raw, normalized.merchant_name || null, classification.category);
  const buyerPib=normalized.buyer_pib || extractBuyerPib(raw) || null;

  if(!buyerPib && !confirmWithoutBuyerPib){
    return NextResponse.json({
      duplicate:false,
      needs_buyer_pib_confirmation:true,
      warning:"Račun nema ID / PIB kupca.",
      status,
      preview:{
        merchant_name:normalized.merchant_name||null,
        invoice_number:normalized.invoice_number||null,
        sdc_time:normalized.sdc_time||null,
        total_amount:normalized.total_amount??null,
        total_tax:normalized.total_tax??null
      }
    });
  }

  const buyer=buyerPib?await resolveBuyer(buyerPib):null;
  const bookkeepingEligible=Boolean(buyerPib);

  const { data, error } = await supabase.from("receipts").insert({
    organization_id:organizationId,
    created_by:user.id,
    qr_url:qrUrl,
    receipt_fingerprint:fingerprint,
    merchant_name:normalized.merchant_name || null,
    merchant_pib:normalized.merchant_pib || null,
    invoice_number:normalized.invoice_number || null,
    sdc_time:normalized.sdc_time || null,
    total_amount:normalized.total_amount ?? null,
    total_tax:normalized.total_tax ?? null,
    payment_method:normalized.payment_method || null,
    ...(buyerPib?buyerPatch(buyerPib,buyer):{}),
    buyer_pib_status:buyerPib?"present":"missing",
    saved_without_buyer_pib:!buyerPib,
    bookkeeping_eligible:bookkeepingEligible,
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
    const dup=await findDuplicate(supabase,organizationId,qrUrl,fingerprint);
    if(dup)return NextResponse.json({duplicate:true,message:"Ovaj račun je već skeniran.",id:dup.id,receipt:dup});
  }
  if (error) return NextResponse.json({error:'Račun nije sačuvan. Pokušajte ponovo.'},{status:400});

  let aiAnalysis:any=null;
  try{
    const admin=createAdminClient();
    const {data:organization}=await admin.from("organizations").select("id,pib,activity_code,activity_name").eq("id",organizationId).maybeSingle();
    aiAnalysis=await ensureVatAiAnalysis(admin,data,organization||{});
  }catch(e:any){
    console.warn("[FiscalBox receipt] VAT AI scan analysis failed",String(e?.message||e).slice(0,180));
  }

  return NextResponse.json({duplicate:false,id:data.id,status,receipt:data,classification,warranty,aiAnalysis,bookkeeping_eligible:bookkeepingEligible});
}
