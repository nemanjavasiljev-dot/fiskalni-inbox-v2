import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_FILE = 20 * 1024 * 1024;
function safeName(name: string) {
  const cleaned = name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return cleaned.slice(0, 120) || "dokument";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const body = await request.json();
  const organizationId = String(body.organization_id || "");
  const fileName = String(body.file_name || "dokument");
  const size = Number(body.size_bytes || 0);
  const source = ["scan", "camera", "upload"].includes(String(body.source)) ? String(body.source) : "upload";
  if (!organizationId || !Number.isSafeInteger(size) || size <= 0 || size > MAX_FILE) return NextResponse.json({ error: "Fajl mora biti manji od 20 MB." }, { status: 400 });

  const { data: membership } = await supabase.from("organization_members").select("role").eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle();
  if (!membership || membership.role === "accountant") return NextResponse.json({ error: "Nemate pravo dodavanja dokumenata za ovu firmu." }, { status: 403 });

  const {data:allowed,error:accessError}=await supabase.rpc('can_manage_org_documents',{org:organizationId});
  if(accessError||!allowed)return NextResponse.json({error:'Dodavanje dokumenata nije dostupno za ovu firmu.'},{status:403});
  const path = `${organizationId}/${user.id}/${crypto.randomUUID()}-${safeName(fileName)}`;
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("documents").createSignedUploadUrl(path);
  if (error || !data?.token) return NextResponse.json({ error: error?.message || "Upload token nije kreiran." }, { status: 500 });
  return NextResponse.json({ path, token: data.token, source });
}
