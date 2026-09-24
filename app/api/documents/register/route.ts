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

  if(path.split('/').some(part=>part==='..'||part==='.')||path.split('/').length!==3)return NextResponse.json({error:'Neispravna putanja.'},{status:400});
  const admin=createAdminClient();
  const fileBase=path.slice(path.lastIndexOf('/')+1);
  const folder=path.slice(0,path.lastIndexOf('/'));
  const {data:objects,error:objectError}=await admin.storage.from('documents').list(folder,{search:fileBase,limit:100});
  const object=objects?.find(o=>o.name===fileBase);
  const storedSize=Number(object?.metadata?.size);
  if(objectError||!object||!Number.isSafeInteger(storedSize)||storedSize<=0||storedSize>20*1024*1024)return NextResponse.json({error:'Fajl nije uspešno otpremljen ili je prevelik. Ponovite otpremanje.'},{status:400});
  const {data:existing}=await supabase.from('documents').select('*').eq('storage_path',path).maybeSingle();
  if(existing)return NextResponse.json({ok:true,document:existing,duplicate:true});
  const { data, error } = await supabase.from("documents").insert({
    organization_id: org,
    uploaded_by: user.id,
    file_name: fileName,
    storage_path: path,
    mime_type: String(object.metadata?.mimetype || "") || null,
    size_bytes: storedSize,
    source
  }).select("*").single();

  if (error) {
    // Keep the uploaded object for a retry; deleting on a concurrent duplicate could destroy the valid document.
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, document: data });
}
