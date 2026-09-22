import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });
  const body = await request.json();
  const org = String(body.organization_id || "");
  const path = String(body.storage_path || "");
  const fileName = String(body.file_name || "dokument");
  const source = ["scan", "camera", "upload"].includes(String(body.source)) ? String(body.source) : "upload";
  if (!org || !path.startsWith(`${org}/${user.id}/`)) return NextResponse.json({ error: "Neispravna putanja dokumenta." }, { status: 400 });

  const { data: membership } = await supabase.from("organization_members").select("role").eq("organization_id", org).eq("user_id", user.id).maybeSingle();
  if (!membership || membership.role === "accountant") return NextResponse.json({ error: "Nemate pravo dodavanja dokumenata." }, { status: 403 });

  const { data, error } = await supabase.from("documents").insert({
    organization_id: org,
    uploaded_by: user.id,
    file_name: fileName,
    storage_path: path,
    mime_type: String(body.mime_type || "") || null,
    size_bytes: Number(body.size_bytes || 0),
    source
  }).select("*").single();

  if (error) {
    const admin = createAdminClient();
    await admin.storage.from("documents").remove([path]);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, document: data });
}
