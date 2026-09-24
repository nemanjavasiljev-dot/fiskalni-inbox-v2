import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_LOGO = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const { organization_id, file_name, size_bytes } = await request.json();
  const org = String(organization_id || "");
  const size = Number(size_bytes || 0);
  if (!org || !Number.isSafeInteger(size) || size <= 0 || size > MAX_LOGO) return NextResponse.json({ error: "Logo mora biti slika manja od 5 MB." }, { status: 400 });

  const { data: membership } = await supabase.from("organization_members").select("role").eq("organization_id", org).eq("user_id", user.id).maybeSingle();
  if (!membership || membership.role === "accountant") return NextResponse.json({ error: "Nemate pravo menjanja logoa ove firme." }, { status: 403 });

  const ext = String(file_name || "logo.jpg").split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "jpg";
  if(!['jpg','jpeg','png','webp'].includes(ext.toLowerCase()))return NextResponse.json({error:'Logo mora biti JPG, PNG ili WebP slika.'},{status:400});
  const path = `${org}/logo-${crypto.randomUUID()}.${ext.slice(0, 8)}`;
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("organization-assets").createSignedUploadUrl(path);
  if (error || !data?.token) return NextResponse.json({ error: error?.message || "Upload token nije kreiran." }, { status: 500 });
  return NextResponse.json({ path, token: data.token });
}
