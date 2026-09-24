import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthorizedAccountantClientIds } from "@/lib/accountant-download-access";
import { sendPushToOrganization } from "@/lib/push-delivery";

export const runtime="nodejs";
const MAX_FILE=20*1024*1024;

function safeName(name:string){
  return name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").slice(0,120)||"dokument";
}

async function resolveAccountingOffice(admin:any,userId:string,clientId:string){
  const {data:members}=await admin.from("organization_members")
    .select("organization_id,role,accounting_access_role")
    .eq("user_id",userId)
    .in("role",["owner","employee"]);
  const officeIds=(members||[]).map((m:any)=>String(m.organization_id)).filter(Boolean);
  if(!officeIds.length)return null;
  const {data:offices}=await admin.from("organizations").select("id,organization_type").in("id",officeIds).eq("organization_type","accounting");
  const validOfficeIds=(offices||[]).map((o:any)=>String(o.id));
  if(!validOfficeIds.length)return null;
  const {data:relations}=await admin.from("accountant_company")
    .select("accountant_organization_id")
    .eq("client_organization_id",clientId)
    .eq("status","active")
    .in("accountant_organization_id",validOfficeIds)
    .limit(1);
  return relations?.[0]?.accountant_organization_id?String(relations[0].accountant_organization_id):null;
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const {id:clientId}=await params;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Niste prijavljeni."},{status:401});
  const admin=createAdminClient();
  const allowed=await getAuthorizedAccountantClientIds(admin,user.id,clientId);
  if(!allowed.includes(clientId))return NextResponse.json({error:"Nemate pristup ovom klijentu."},{status:403});

  const form=await request.formData();
  const file=form.get("file");
  const pushMessage=String(form.get("push_message")||"").trim().slice(0,500);
  if(!(file instanceof File))return NextResponse.json({error:"Izaberite dokument."},{status:400});
  if(file.size<=0||file.size>MAX_FILE)return NextResponse.json({error:"Dokument mora biti manji od 20 MB."},{status:400});

  const officeId=await resolveAccountingOffice(admin,user.id,clientId);
  if(!officeId)return NextResponse.json({error:"Aktivna veza sa klijentom nije pronađena."},{status:403});
  const {data:client}=await admin.from("organizations").select("id,name,company_id").eq("id",clientId).maybeSingle();
  if(!client)return NextResponse.json({error:"Klijent nije pronađen."},{status:404});
  const path=`${clientId}/accountant-${user.id}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const bytes=Buffer.from(await file.arrayBuffer());
  const {error:uploadError}=await admin.storage.from("documents").upload(path,bytes,{contentType:file.type||"application/octet-stream",upsert:false});
  if(uploadError)return NextResponse.json({error:uploadError.message||"Dokument nije otpremljen."},{status:500});

  const now=new Date().toISOString();
  const {data:document,error:insertError}=await admin.from("documents").insert({
    organization_id:clientId,
    company_id:client.company_id||null,
    uploaded_by:user.id,
    file_name:file.name,
    storage_path:path,
    mime_type:file.type||null,
    size_bytes:file.size,
    source:"upload",
    status:"inbox",
    direction:"accountant_to_client",
    accountant_message:pushMessage||null,
    archived_at:now,
    sent_from_organization_id:officeId,
    sent_to_client_at:now,
    sent_to_client_by:user.id
  }).select("*").single();
  if(insertError){
    await admin.storage.from("documents").remove([path]).catch(()=>{});
    return NextResponse.json({error:insertError.message||"Dokument nije evidentiran."},{status:400});
  }

  const body=pushMessage
    ? `Knjigovođa vam je poslao dokument „${file.name}“. ${pushMessage}`
    : `Knjigovođa vam je poslao dokument „${file.name}“. Dokument je sačuvan u FiscalBox arhivi.`;
  const push=await sendPushToOrganization(admin,clientId,{
    title:"Novi dokument od knjigovođe",
    body,
    url:`/app/files?org=${encodeURIComponent(clientId)}`,
    tag:`accountant-document-${document.id}`,
    notificationType:"accountant_document"
  }).catch(()=>null);

  return NextResponse.json({ok:true,document,push});
}
