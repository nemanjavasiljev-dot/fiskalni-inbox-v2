import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });
  const { id } = await params;
  const { data: doc, error } = await supabase.from("documents").select("id,storage_path,file_name").eq("id", id).maybeSingle();
  if (error || !doc) return NextResponse.json({ error: "Dokument nije pronađen ili nemate pristup." }, { status: 404 });

  const admin = createAdminClient();
  const { data, error: signedError } = await admin.storage.from("documents").createSignedUrl(doc.storage_path, 90, { download: doc.file_name });
  if (signedError || !data?.signedUrl) return NextResponse.json({ error: "Preuzimanje trenutno nije dostupno." }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
