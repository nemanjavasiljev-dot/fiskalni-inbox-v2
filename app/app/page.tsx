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
    .select("organization_id,role,organizations(id,name,pib,registration_number,legal_form,address,municipality,activity_code,activity_name,plan,status,organization_type,trial_ends_at,accountant_pib_pending,accountant_contact_email,logo_path,receipt_send_schedule,last_auto_receipt_send_at)")
    .eq("user_id",user.id);

  const params = await searchParams;
  const orgs = (memberships||[]).map((m:any)=>({
    organization_id:m.organization_id,role:m.role,...m.organizations
  }));
  const activeOrg = params.org ? orgs.find((x:any)=>x.organization_id===params.org) : orgs[0];

  let accountantOverview:any = null;
  const accountantOrgs = orgs.filter((o:any)=>o.role === "accountant");
  const accountantOnly = profile.global_role === "accountant" && profile.global_role !== "master_admin";
  if (accountantOnly) {
    const orgIds = accountantOrgs.map((o:any)=>o.organization_id);
    if (orgIds.length > 0) {
      const [{data:allReceipts},{data:allDocuments},{data:receiptStatuses},{data:documentStatuses}] = await Promise.all([
        supabase.from("receipts")
          .select("id,organization_id,merchant_name,merchant_pib,invoice_number,sdc_time,total_amount,total_tax,category,sent_to_accountant_at,created_at")
          .in("organization_id",orgIds).not("sent_to_accountant_at","is",null)
          .order("sent_to_accountant_at",{ascending:false}).limit(2000),
        supabase.from("documents")
          .select("id,organization_id,file_name,mime_type,size_bytes,source,status,sent_at,created_at")
          .in("organization_id",orgIds).eq("status","sent")
          .order("sent_at",{ascending:false}).limit(2000),
        supabase.from("accountant_receipt_status").select("*").eq("accountant_user_id",user.id),
        supabase.from("accountant_document_status").select("*").eq("accountant_user_id",user.id)
      ]);
      accountantOverview = {receipts:allReceipts||[],documents:allDocuments||[],receiptStatuses:receiptStatuses||[],documentStatuses:documentStatuses||[]};
    } else {
      accountantOverview = {receipts:[],documents:[],receiptStatuses:[],documentStatuses:[]};
    }
  }

  let receipts:any[] = [];
  if (activeOrg && !accountantOnly) {
    let query = supabase.from("receipts")
      .select("*").eq("organization_id",activeOrg.organization_id)
      .order("created_at",{ascending:false}).limit(250);
    if (activeOrg.role === "accountant") query = query.not("sent_to_accountant_at","is",null);
    const { data } = await query;
    receipts = data || [];
  }

  let master:any = null;
  if (profile.global_role === "master_admin") {
    const [{data:organizations},{data:allMembers},{data:allProfiles},{data:allReceipts}] = await Promise.all([
      supabase.from("organizations").select("*").order("created_at",{ascending:false}),
      supabase.from("organization_members").select("organization_id,user_id,role"),
      supabase.from("profiles").select("user_id,username,full_name,auth_email,global_role,created_at"),
      supabase.from("receipts").select("id,organization_id,created_at,sent_to_accountant_at")
    ]);
    master = {organizations:organizations||[],members:allMembers||[],profiles:allProfiles||[],receipts:allReceipts||[]};
  }

  return <Dashboard profile={profile} organizations={orgs} activeOrg={activeOrg||null} receipts={receipts} master={master} accountantOverview={accountantOverview} />;
}
