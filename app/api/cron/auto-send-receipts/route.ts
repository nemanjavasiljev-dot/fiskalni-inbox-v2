import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function isLastDayUTC(now: Date) {
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return tomorrow.getUTCDate() === 1;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const { data: organizations, error } = await admin.from("organizations")
    .select("id,receipt_send_schedule,last_auto_receipt_send_at")
    .in("receipt_send_schedule", ["weekly", "monthly"]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let organizationsProcessed = 0;
  let receiptsSent = 0;
  for (const org of organizations || []) {
    const due = org.receipt_send_schedule === "weekly" ? now.getUTCDay() === 5 : isLastDayUTC(now);
    if (!due) continue;
    if (org.last_auto_receipt_send_at && String(org.last_auto_receipt_send_at).slice(0, 10) === today) continue;

    const { data: accountant } = await admin.from("organization_members").select("id").eq("organization_id", org.id).eq("role", "accountant").limit(1).maybeSingle();
    if (!accountant) continue;

    const sentAt = now.toISOString();
    const { data: rows } = await admin.from("receipts")
      .update({ sent_to_accountant_at: sentAt })
      .eq("organization_id", org.id)
      .is("sent_to_accountant_at", null)
      .select("id");
    await admin.from("organizations").update({ last_auto_receipt_send_at: sentAt }).eq("id", org.id);
    organizationsProcessed += 1;
    receiptsSent += rows?.length || 0;
  }

  return NextResponse.json({ ok: true, organizations: organizationsProcessed, receipts: receiptsSent });
}
