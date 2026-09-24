import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FilesWorkspace from "./files-ui";

export default async function FilesPage({ searchParams }: { searchParams: Promise<{ org?: string; tab?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
  if (!profile) redirect("/login");

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("organization_id,role,organizations(id,name,pib,plan,status,logo_path)")
    .eq("user_id", user.id);

  const params = await searchParams;
  const organizations = (memberships || []).map((m: any) => ({ organization_id: m.organization_id, role: m.role, ...m.organizations }));
  const activeOrg = params.org ? organizations.find((x: any) => x.organization_id === params.org) : organizations[0];
  if (!activeOrg) redirect("/app/setup");

  let query = supabase.from("documents").select("*").eq("organization_id", activeOrg.organization_id).order("created_at", { ascending: false });
  if (activeOrg.role === "accountant") query = query.eq("status", "sent");
  const [{ data: documents }, { data: billingDocuments }, { data: warrantyReceipts }] = await Promise.all([
    query,
    activeOrg.role === "accountant"
      ? Promise.resolve({data:[] as any[]})
      : supabase.from("billing_invoices").select("*").eq("organization_id",activeOrg.organization_id).order("issued_at",{ascending:false}),
    activeOrg.role === "accountant"
      ? Promise.resolve({data:[] as any[]})
      : supabase.from("receipts").select("id,merchant_name,merchant_pib,invoice_number,sdc_time,created_at,total_amount,warranty_archived_at,warranty_source,warranty_note").eq("organization_id",activeOrg.organization_id).not("warranty_archived_at","is",null).order("warranty_archived_at",{ascending:false})
  ]);

  return <FilesWorkspace profile={profile} organizations={organizations} activeOrg={activeOrg} initialDocuments={documents || []} initialBillingDocuments={billingDocuments || []} initialWarrantyReceipts={warrantyReceipts || []} initialTab={params.tab} />;
}
