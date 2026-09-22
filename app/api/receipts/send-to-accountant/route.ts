import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const { organization_id } = await request.json();
  const org = String(organization_id || "");
  const { data: membership } = await supabase.from("organization_members").select("role").eq("organization_id", org).eq("user_id", user.id).maybeSingle();
  if (!membership || membership.role === "accountant") return NextResponse.json({ error: "Nemate pravo slanja računa." }, { status: 403 });

  const { data: accountant } = await supabase.from("organization_members").select("id").eq("organization_id", org).eq("role", "accountant").limit(1).maybeSingle();
  if (!accountant) return NextResponse.json({ error: "Firmi još nije dodeljen knjigovođa." }, { status: 400 });

  const sentAt = new Date().toISOString();
  const { data, error } = await supabase.from("receipts")
    .update({ sent_to_accountant_at: sentAt, sent_by: user.id })
    .eq("organization_id", org)
    .is("sent_to_accountant_at", null)
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, sent: data?.length || 0, sent_at: sentAt });
}
