import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const { organization_id, schedule } = await request.json();
  const org = String(organization_id || "");
  const selected = ["manual", "weekly", "monthly"].includes(String(schedule)) ? String(schedule) : "manual";
  const { data: membership } = await supabase.from("organization_members").select("role").eq("organization_id", org).eq("user_id", user.id).maybeSingle();
  if (!membership || membership.role === "accountant") return NextResponse.json({ error: "Nemate pravo menjanja ovog podešavanja." }, { status: 403 });

  const { error } = await supabase.from("organizations").update({ receipt_send_schedule: selected }).eq("id", org);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, schedule: selected });
}
