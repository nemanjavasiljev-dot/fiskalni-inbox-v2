import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const { organization_id, ids } = await request.json();
  const org = String(organization_id || "");
  const documentIds = Array.isArray(ids) ? ids.map(String).filter(Boolean) : [];
  if (!org || documentIds.length === 0) return NextResponse.json({ error: "Označite dokumente za slanje." }, { status: 400 });

  const { data: membership } = await supabase.from("organization_members")
    .select("role").eq("organization_id", org).eq("user_id", user.id).maybeSingle();
  if (!membership || membership.role === "accountant") return NextResponse.json({ error: "Nemate pravo slanja dokumenata." }, { status: 403 });

  const { data, error } = await supabase.from("documents")
    .update({ status: "sent", sent_at: new Date().toISOString(), sent_by: user.id })
    .eq("organization_id", org)
    .eq("status", "inbox")
    .in("id", documentIds)
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, sent: data?.length || 0 });
}
