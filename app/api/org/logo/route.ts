import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const org = new URL(request.url).searchParams.get("organization_id") || "";
  if (!org) return new Response("Missing organization_id", { status: 400 });

  const { data: membership } = await supabase.from("organization_members").select("role").eq("organization_id", org).eq("user_id", user.id).maybeSingle();
  const { data: profile } = await supabase.from("profiles").select("global_role").eq("user_id", user.id).maybeSingle();
  if (!membership && profile?.global_role !== "master_admin") return new Response("Forbidden", { status: 403 });

  const { data: organization } = await supabase.from("organizations").select("logo_path").eq("id", org).maybeSingle();
  if (!organization?.logo_path) return new Response("Not found", { status: 404 });
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("organization-assets").createSignedUrl(organization.logo_path, 300);
  if (error || !data?.signedUrl) return new Response("Not found", { status: 404 });
  return NextResponse.redirect(data.signedUrl, { status: 302 });
}
