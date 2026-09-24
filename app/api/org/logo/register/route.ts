import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const { organization_id, path } = await request.json();
  const org = String(organization_id || "");
  const logoPath = String(path || "");
  if (!org || !logoPath.startsWith(`${org}/`)) return NextResponse.json({ error: "Neispravna putanja logoa." }, { status: 400 });

  const { data: membership } = await supabase.from("organization_members").select("role").eq("organization_id", org).eq("user_id", user.id).maybeSingle();
  if (!membership || membership.role === "accountant") return NextResponse.json({ error: "Nemate pravo menjanja logoa." }, { status: 403 });

  const { data: oldOrg } = await supabase.from("organizations").select("logo_path").eq("id", org).maybeSingle();
  const { error } = await createAdminClient().from("organizations").update({ logo_path: logoPath }).eq("id", org);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const oldPath = String(oldOrg?.logo_path || "");
  if (oldPath && oldPath !== logoPath) {
    const admin = createAdminClient();
    await admin.storage.from("organization-assets").remove([oldPath]);
  }
  return NextResponse.json({ ok: true });
}
