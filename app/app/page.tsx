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
    .select("organization_id,role,organizations(id,name,pib,plan,status)")
    .eq("user_id",user.id);

  const params = await searchParams;
  const orgs = (memberships||[]).map((m:any)=>({
    organization_id:m.organization_id,role:m.role,...m.organizations
  }));
  let activeOrg = params.org ? orgs.find((x:any)=>x.organization_id===params.org) : orgs[0];

  let receipts:any[] = [];
  if (activeOrg) {
    const { data } = await supabase.from("receipts")
      .select("*").eq("organization_id",activeOrg.organization_id)
      .order("created_at",{ascending:false}).limit(200);
    receipts = data || [];
  }

  let master:any = null;
  if (profile.global_role === "master_admin") {
    const [{data:organizations},{data:allMembers},{data:allProfiles},{data:allReceipts}] = await Promise.all([
      supabase.from("organizations").select("*").order("created_at",{ascending:false}),
      supabase.from("organization_members").select("organization_id,user_id,role"),
      supabase.from("profiles").select("user_id,username,full_name,global_role,created_at"),
      supabase.from("receipts").select("id,organization_id,created_at")
    ]);
    master = {organizations:organizations||[],members:allMembers||[],profiles:allProfiles||[],receipts:allReceipts||[]};
  }

  return <Dashboard profile={profile} organizations={orgs} activeOrg={activeOrg||null} receipts={receipts} master={master} />;
}
