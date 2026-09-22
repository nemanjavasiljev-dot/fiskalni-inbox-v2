import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });
  const { id } = await params;
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "view" ? "view" : "download";

  const { data: doc, error } = await supabase.from("documents")
    .select("id,organization_id,storage_path,file_name,status")
    .eq("id", id)
    .maybeSingle();
  if (error || !doc) return NextResponse.json({ error: "Dokument nije pronađen ili nemate pristup." }, { status: 404 });

  const { data: membership } = await supabase.from("organization_members")
    .select("role")
    .eq("organization_id", doc.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership?.role === "accountant" && doc.status === "sent") {
    const now = new Date().toISOString();
    const { data: existing } = await supabase.from("accountant_document_status")
      .select("opened_at,downloaded_at")
      .eq("accountant_user_id", user.id)
      .eq("document_id", doc.id)
      .maybeSingle();
    await supabase.from("accountant_document_status").upsert({
      accountant_user_id: user.id,
      organization_id: doc.organization_id,
      document_id: doc.id,
      opened_at: existing?.opened_at || now,
      downloaded_at: mode === "download" ? now : existing?.downloaded_at || null,
      updated_at: now
    }, { onConflict: "accountant_user_id,document_id" });
  }

  const admin = createAdminClient();
  const options = mode === "download" ? { download: doc.file_name } : undefined;
  const { data, error: signedError } = await admin.storage.from("documents").createSignedUrl(doc.storage_path, 90, options);
  if (signedError || !data?.signedUrl) return NextResponse.json({ error: "Dokument trenutno nije dostupan." }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
