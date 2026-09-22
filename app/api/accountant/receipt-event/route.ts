import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const body = await request.json();
  const receiptId = String(body.receipt_id || "");
  const action = String(body.action || "open");
  if (!receiptId || !["open", "download", "print"].includes(action)) {
    return NextResponse.json({ error: "Neispravan zahtev." }, { status: 400 });
  }

  const { data: receipt } = await supabase
    .from("receipts")
    .select("id,organization_id,sent_to_accountant_at")
    .eq("id", receiptId)
    .maybeSingle();

  if (!receipt?.sent_to_accountant_at) {
    return NextResponse.json({ error: "Račun nije dostupan knjigovođi." }, { status: 404 });
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", receipt.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || membership.role !== "accountant") {
    return NextResponse.json({ error: "Nemate pristup ovom računu." }, { status: 403 });
  }

  const now = new Date().toISOString();
  const patch: Record<string, string> = { updated_at: now };
  if (action === "open") patch.opened_at = now;
  if (action === "download") { patch.opened_at = now; patch.downloaded_at = now; }
  if (action === "print") { patch.opened_at = now; patch.printed_at = now; }

  const { data: existing } = await supabase
    .from("accountant_receipt_status")
    .select("opened_at,downloaded_at,printed_at")
    .eq("accountant_user_id", user.id)
    .eq("receipt_id", receiptId)
    .maybeSingle();

  const payload = {
    accountant_user_id: user.id,
    organization_id: receipt.organization_id,
    receipt_id: receiptId,
    opened_at: patch.opened_at || existing?.opened_at || null,
    downloaded_at: patch.downloaded_at || existing?.downloaded_at || null,
    printed_at: patch.printed_at || existing?.printed_at || null,
    updated_at: now
  };

  const { data, error } = await supabase
    .from("accountant_receipt_status")
    .upsert(payload, { onConflict: "accountant_user_id,receipt_id" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, status: data });
}
