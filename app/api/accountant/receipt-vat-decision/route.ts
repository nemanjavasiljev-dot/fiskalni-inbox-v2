import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Niste prijavljeni."},{status:401});

  const body=await request.json().catch(()=>({}));
  const receiptId=String(body.receipt_id||"");
  const decision=body.vat_deductible;
  const note=String(body.note||"").trim().slice(0,1000)||null;
  if(!receiptId||typeof decision!=="boolean")return NextResponse.json({error:"Neispravan zahtev."},{status:400});

  const admin=createAdminClient();
  const {data:receipt}=await admin.from("receipts")
    .select("id,organization_id,sent_to_accountant_at,ai_vat_recommendation,ai_vat_confidence")
    .eq("id",receiptId).maybeSingle();
  if(!receipt?.sent_to_accountant_at)return NextResponse.json({error:"Račun nije dostupan knjigovođi."},{status:404});

  const {data:membership}=await admin.from("organization_members")
    .select("role").eq("organization_id",receipt.organization_id).eq("user_id",user.id).maybeSingle();
  if(!membership||membership.role!=="accountant")return NextResponse.json({error:"Nemate pristup ovom računu."},{status:403});

  const now=new Date().toISOString();
  const {error:updateError}=await admin.from("receipts").update({
    vat_deductible:decision,
    vat_decided_at:now,
    vat_decided_by:user.id,
    vat_decision_note:note
  }).eq("id",receiptId);
  if(updateError)return NextResponse.json({error:updateError.message},{status:400});

  const {error:logError}=await admin.from("receipt_vat_decision_log").insert({
    receipt_id:receiptId,
    organization_id:receipt.organization_id,
    accountant_user_id:user.id,
    vat_deductible:decision,
    ai_recommendation:receipt.ai_vat_recommendation||null,
    ai_confidence:receipt.ai_vat_confidence||null,
    note
  });
  if(logError)return NextResponse.json({error:logError.message},{status:400});

  return NextResponse.json({ok:true,vat_deductible:decision,vat_decided_at:now});
}
