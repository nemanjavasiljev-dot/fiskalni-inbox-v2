import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normEmail(value:any){return String(value||"").trim().toLowerCase();}

export async function GET(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Niste prijavljeni."},{status:401});

  const {data:profile}=await supabase.from("profiles").select("auth_email").eq("user_id",user.id).maybeSingle();
  const {data:memberships}=await supabase
    .from("organization_members")
    .select("organization_id,role,accounting_access_role,organizations(id,name,organization_type,owner_user_id)")
    .eq("user_id",user.id);

  const rows=(memberships||[]).map((m:any)=>({
    organization_id:m.organization_id,
    role:m.role,
    accounting_access_role:m.accounting_access_role,
    ...(m.organizations||{})
  }));
  const clientOrgIds=rows.filter((o:any)=>o.role==="accountant").map((o:any)=>String(o.organization_id));
  const office:any=rows.find((o:any)=>o.organization_type==="accounting"&&(o.role==="owner"||o.role==="employee"));

  let notifyReceipts=true,notifyDocuments=true;
  if(office){
    const {data:settings}=await supabase.from("accountant_user_settings")
      .select("notify_new_receipts,notify_new_documents")
      .eq("user_id",user.id)
      .eq("accounting_organization_id",office.organization_id)
      .maybeSingle();
    if(settings){notifyReceipts=settings.notify_new_receipts!==false;notifyDocuments=settings.notify_new_documents!==false;}
  }

  let receipts:any[]=[];
  let documents:any[]=[];
  let receiptStatuses:any[]=[];
  let documentStatuses:any[]=[];
  if(clientOrgIds.length){
    const [rr,dd,rs,ds]=await Promise.all([
      supabase.from("receipts").select("id,organization_id,merchant_name,invoice_number,sent_to_accountant_at,created_at").in("organization_id",clientOrgIds).not("sent_to_accountant_at","is",null).order("sent_to_accountant_at",{ascending:false}).limit(300),
      supabase.from("documents").select("id,organization_id,file_name,sent_at,created_at").in("organization_id",clientOrgIds).eq("status","sent").order("sent_at",{ascending:false}).limit(300),
      supabase.from("accountant_receipt_status").select("receipt_id,opened_at").eq("accountant_user_id",user.id),
      supabase.from("accountant_document_status").select("document_id,opened_at").eq("accountant_user_id",user.id)
    ]);
    receipts=rr.data||[];documents=dd.data||[];receiptStatuses=rs.data||[];documentStatuses=ds.data||[];
  }

  const openedReceipts=new Set(receiptStatuses.filter((x:any)=>x.opened_at).map((x:any)=>String(x.receipt_id)));
  const openedDocuments=new Set(documentStatuses.filter((x:any)=>x.opened_at).map((x:any)=>String(x.document_id)));
  const unreadReceipts=notifyReceipts?receipts.filter((r:any)=>!openedReceipts.has(String(r.id))):[];
  const unreadDocuments=notifyDocuments?documents.filter((d:any)=>!openedDocuments.has(String(d.id))):[];

  let connectionRequests:any[]=[];
  if(office){
    const admin=createAdminClient();
    const now=new Date().toISOString();
    const email=normEmail(profile?.auth_email||user.email||"");
    const base=()=>admin.from("connection_requests").select("*").eq("target_kind","accounting").eq("status","pending").gt("expires_at",now).order("created_at",{ascending:false}).limit(100);
    const [direct,byEmail]=await Promise.all([
      base().eq("target_organization_id",String(office.organization_id)),
      email?base().is("target_organization_id",null).eq("channel","email").eq("recipient_email",email):Promise.resolve({data:[] as any[]} as any)
    ]);
    const merged=[...(direct.data||[]),...(byEmail.data||[])];
    const dedup=new Map<string,any>();
    for(const item of merged)dedup.set(String(item.id),item);
    connectionRequests=Array.from(dedup.values());
    const senderIds=Array.from(new Set(connectionRequests.map((r:any)=>String(r.sender_organization_id)).filter(Boolean)));
    const {data:senders}=senderIds.length?await admin.from("organizations").select("id,name,pib").in("id",senderIds):{data:[] as any[]};
    const senderMap=new Map((senders||[]).map((o:any)=>[String(o.id),o]));
    connectionRequests=connectionRequests.map((r:any)=>({...r,sender_organization:senderMap.get(String(r.sender_organization_id))||null}));
  }

  const items=[
    ...unreadDocuments.slice(0,6).map((d:any)=>({kind:"Dokument",id:d.id,org:d.organization_id,title:d.file_name,date:d.sent_at||d.created_at})),
    ...unreadReceipts.slice(0,6).map((r:any)=>({kind:"Račun",id:r.id,org:r.organization_id,title:r.merchant_name||r.invoice_number||"Fiskalni račun",date:r.sent_to_accountant_at||r.created_at}))
  ].sort((a:any,b:any)=>new Date(b.date).getTime()-new Date(a.date).getTime()).slice(0,10);

  const signature=JSON.stringify({
    c:connectionRequests.map((x:any)=>String(x.id)),
    r:unreadReceipts.slice(0,50).map((x:any)=>String(x.id)),
    d:unreadDocuments.slice(0,50).map((x:any)=>String(x.id))
  });

  return NextResponse.json({
    ok:true,
    checked_at:new Date().toISOString(),
    count:connectionRequests.length+unreadReceipts.length+unreadDocuments.length,
    connection_requests:connectionRequests,
    items,
    signature
  },{headers:{"Cache-Control":"private, no-store, max-age=0"}});
}
