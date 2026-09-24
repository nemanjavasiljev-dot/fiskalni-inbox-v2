import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Niste prijavljeni."},{status:401});
  const body=await request.json().catch(()=>({}));
  const receiptId=String(body.receipt_id||"");
  const action=body.action==="remove"?"remove":"archive";
  if(!receiptId)return NextResponse.json({error:"Nedostaje račun."},{status:400});
  const {data:receipt}=await supabase.from("receipts").select("id,organization_id").eq("id",receiptId).maybeSingle();
  if(!receipt)return NextResponse.json({error:"Račun nije pronađen."},{status:404});
  const {data:allowed,error:accessError}=await supabase.rpc("can_manage_org_documents",{org:receipt.organization_id});
  if(accessError||!allowed)return NextResponse.json({error:"Nemate pravo izmene ovog računa."},{status:403});
  const patch=action==="remove"
    ? {warranty_archived_at:null,warranty_source:null,warranty_note:null}
    : {warranty_archived_at:new Date().toISOString(),warranty_source:"manual",warranty_note:"Korisnik je označio fiskalni račun kao dokaz kupovine za garanciju."};
  const {data,error}=await supabase.from("receipts").update(patch).eq("id",receiptId).select("*").single();
  if(error)return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({ok:true,receipt:data});
}
