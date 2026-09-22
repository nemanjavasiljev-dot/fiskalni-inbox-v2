import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Dashboard from "./ui";

export default async function AppPage({searchParams}:{searchParams:Promise<{org?:string}>}) {
  const supabase = await createClient();
  const { data:{user} } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data:profile } = await supabase.from("profiles").select("*").eq("user_id",user.id).single();
  if (!profile) redirect("/login");

  const { data:memberships } = await supabase
    .from("organization_members")
    .select("id,organization_id,role,accounting_access_role,organizations(id,name,pib,registration_number,legal_form,address,municipality,activity_code,activity_name,plan,status,organization_type,trial_ends_at,accountant_pib_pending,accountant_contact_email,logo_path,receipt_send_schedule,last_auto_receipt_send_at,owner_user_id,contact_email,contact_phone,service_block_reason,service_blocked_at)")
    .eq("user_id",user.id);

  const params = await searchParams;
  const orgs = (memberships||[]).map((m:any)=>({organization_id:m.organization_id,role:m.role,...m.organizations}));
  const activeOrg = params.org ? orgs.find((x:any)=>x.organization_id===params.org) : orgs[0];

  let accountantOverview:any = null;
  let accountantContext:any = null;
  const accountantOrgs = orgs.filter((o:any)=>o.role === "accountant");
  const accountingOffice:any = orgs.find((o:any)=>o.organization_type === "accounting" && (o.role === "owner" || o.role === "employee"));
  const accountantOnly = profile.global_role === "accountant" && profile.global_role !== "master_admin";
  if (accountantOnly) {
    const orgIds = accountantOrgs.map((o:any)=>o.organization_id);
    if (orgIds.length > 0) {
      const [{data:allReceipts},{data:allDocuments},{data:receiptStatuses},{data:documentStatuses}] = await Promise.all([
        supabase.from("receipts").select("id,organization_id,merchant_name,merchant_pib,invoice_number,sdc_time,total_amount,total_tax,category,sent_to_accountant_at,created_at").in("organization_id",orgIds).not("sent_to_accountant_at","is",null).order("sent_to_accountant_at",{ascending:false}).limit(2000),
        supabase.from("documents").select("id,organization_id,file_name,mime_type,size_bytes,source,status,sent_at,created_at").in("organization_id",orgIds).eq("status","sent").order("sent_at",{ascending:false}).limit(2000),
        supabase.from("accountant_receipt_status").select("*").eq("accountant_user_id",user.id),
        supabase.from("accountant_document_status").select("*").eq("accountant_user_id",user.id)
      ]);
      accountantOverview = {receipts:allReceipts||[],documents:allDocuments||[],receiptStatuses:receiptStatuses||[],documentStatuses:documentStatuses||[]};
    } else accountantOverview = {receipts:[],documents:[],receiptStatuses:[],documentStatuses:[]};

    if(accountingOffice){
      const officeId=accountingOffice.organization_id;
      const [{data:userSettings},{data:pendingInvites}] = await Promise.all([
        supabase.from("accountant_user_settings").select("*").eq("user_id",user.id).eq("accounting_organization_id",officeId).maybeSingle(),
        supabase.from("client_invitations").select("id,company_pib,company_name,email,phone,invite_channel,status,expires_at,created_at,sent_at").eq("accounting_organization_id",officeId).eq("status","pending").order("created_at",{ascending:false}).limit(100)
      ]);
      let staff:any[]=[];let assignments:any[]=[];
      const isAdmin=(accountingOffice.role==="owner" && accountingOffice.owner_user_id===user.id) || accountingOffice.accounting_access_role==="admin";
      if(isAdmin){
        const {data:staffMemberships}=await supabase.from("organization_members").select("user_id,role").eq("organization_id",officeId).in("role",["owner","employee"]);
        const ids=(staffMemberships||[]).map((m:any)=>m.user_id);
        const {data:staffProfiles}=ids.length?await supabase.from("profiles").select("user_id,username,full_name,auth_email,global_role,created_at").in("user_id",ids):{data:[] as any[]};
        const roleMap=new Map((staffMemberships||[]).map((m:any)=>[String(m.user_id),m.role]));
        staff=(staffProfiles||[]).map((p:any)=>({...p,office_role:roleMap.get(String(p.user_id))}));
        const {data:assignmentRows}=await supabase.from("accountant_client_assignments").select("employee_user_id,client_organization_id,created_at").eq("accounting_organization_id",officeId);
        assignments=assignmentRows||[];
      }
      accountantContext={office:accountingOffice,isAdmin,userSettings:userSettings||{notify_new_receipts:true,notify_new_documents:true,notify_deadlines:true},staff,assignments,pendingInvites:pendingInvites||[]};
    }
  }

  let receipts:any[] = [];
  if (activeOrg && !accountantOnly) {
    let query = supabase.from("receipts").select("*").eq("organization_id",activeOrg.organization_id).order("created_at",{ascending:false}).limit(250);
    if (activeOrg.role === "accountant") query = query.not("sent_to_accountant_at","is",null);
    const { data } = await query; receipts = data || [];
  }

  let master:any = null;
  if (profile.global_role === "master_admin") {
    const [{data:organizations},{data:allMembers},{data:allProfiles},{data:allReceipts},{data:billingInvoices},{data:payouts},{data:rewards}] = await Promise.all([
      supabase.from("organizations").select("*").order("created_at",{ascending:false}),
      supabase.from("organization_members").select("id,organization_id,user_id,role,accounting_access_role"),
      supabase.from("profiles").select("user_id,username,full_name,auth_email,global_role,created_at"),
      supabase.from("receipts").select("id,organization_id,created_at,sent_to_accountant_at"),
      supabase.from("billing_invoices").select("*").order("issued_at",{ascending:false}).limit(3000),
      supabase.from("accountant_payouts").select("*").order("period_month",{ascending:false}).limit(1000),
      supabase.from("accountant_rewards").select("*").order("created_at",{ascending:false}).limit(1000)
    ]);
    master = {organizations:organizations||[],members:allMembers||[],profiles:allProfiles||[],receipts:allReceipts||[],billingInvoices:billingInvoices||[],payouts:payouts||[],rewards:rewards||[]};
  }

  return <Dashboard profile={profile} organizations={orgs} activeOrg={activeOrg||null} receipts={receipts} master={master} accountantOverview={accountantOverview} accountantContext={accountantContext} />;
}
