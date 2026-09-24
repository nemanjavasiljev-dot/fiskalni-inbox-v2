import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ClientWorkspace from "./client-ui";

function parseMonth(value?:string){
  if(value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value;
  const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function parseYear(value?:string){
  if(value && /^(19|20)\d{2}$/.test(value)) return value;
  return null;
}

export default async function AccountantClientPage({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{month?:string;year?:string}>}){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {id}=await params;
  const sp=await searchParams;
  const selectedMonth=parseMonth(sp.month);
  const selectedYear=parseYear(sp.year);

  const {data:membership}=await supabase.from("organization_members")
    .select("role,organizations(id,name,pib,registration_number,address,plan,logo_path)")
    .eq("organization_id",id).eq("user_id",user.id).maybeSingle();
  if(!membership||membership.role!=="accountant") notFound();
  const org:any=membership.organizations;

  const [{data:receipts},{data:documents},{data:receiptStatuses},{data:documentStatuses}] = await Promise.all([
    supabase.from("receipts").select("*").eq("organization_id",id).not("sent_to_accountant_at","is",null).order("sdc_time",{ascending:false}).limit(2000),
    supabase.from("documents").select("*").eq("organization_id",id).eq("status","sent").order("sent_at",{ascending:false}).limit(2000),
    supabase.from("accountant_receipt_status").select("*").eq("accountant_user_id",user.id).eq("organization_id",id),
    supabase.from("accountant_document_status").select("*").eq("accountant_user_id",user.id).eq("organization_id",id)
  ]);

  const assignedReceiptIds=new Set((receiptStatuses||[]).filter((s:any)=>s.opened_at).map((s:any)=>String(s.receipt_id)));
  const assignedDocumentIds=new Set((documentStatuses||[]).filter((s:any)=>s.opened_at).map((s:any)=>String(s.document_id)));
  const assignedReceipts=(receipts||[]).filter((r:any)=>assignedReceiptIds.has(String(r.id)));
  const assignedDocuments=(documents||[]).filter((d:any)=>assignedDocumentIds.has(String(d.id)));

  return <ClientWorkspace organization={org} selectedMonth={selectedMonth} selectedYear={selectedYear} receipts={assignedReceipts} documents={assignedDocuments} receiptStatuses={receiptStatuses||[]} documentStatuses={documentStatuses||[]}/>;
}
