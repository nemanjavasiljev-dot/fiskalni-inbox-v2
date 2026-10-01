import { redirect } from "next/navigation";
import { Bell, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import BrandWordmark from "@/components/BrandWordmark";
import CompanyHeaderMenu from "@/components/CompanyHeaderMenu";
import AccountantDesktopMenu from "@/components/AccountantDesktopMenu";
import NotificationCenter from "@/components/NotificationCenter";

export default async function NotificationsPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
  const [{data:profile},{data:memberships},{data:items}]=await Promise.all([
    supabase.from("profiles").select("*").eq("user_id",user.id).single(),
    supabase.from("organization_members").select("organization_id,role,accounting_access_role,organizations(id,name,pib,logo_path,owner_user_id,organization_type)").eq("user_id",user.id),
    supabase.from("user_notifications").select("id,event_key,tag,notification_type,title,body,url,organization_id,read_at,reaction,reacted_at,created_at").eq("user_id",user.id).is("deleted_at",null).order("created_at",{ascending:false}).limit(200)
  ]);
  if(!profile)redirect("/login");
  const rows=memberships||[];
  const accountingMembership:any=rows.find((m:any)=>m.organizations?.organization_type==="accounting"&&["owner","employee"].includes(m.role));
  const isAccountant=profile.global_role==="accountant"&&Boolean(accountingMembership);
  const unread=(items||[]).filter((n:any)=>!n.read_at).length;

  if(isAccountant){
    const office:any=accountingMembership?.organizations||{};
    const isAdmin=(accountingMembership.role==="owner"&&String(office.owner_user_id)===String(user.id))||accountingMembership.accounting_access_role==="admin";
    return <div className="app-shell accountant-shell"><div className="accountant-desktop-layout"><AccountantDesktopMenu isAdmin={isAdmin} username={profile.full_name||profile.username||profile.auth_email||""} notificationCount={unread}/><main className="accountant-main notification-page-main"><div className="app-head notification-page-head"><div><span className="pill"><Bell size={13}/> NOTIFIKACIJE</span><h1>Notifikacije</h1><p className="muted">Pregledajte sistemska obaveštenja, zahteve i događaje, reagujte ili ih uklonite.</p></div></div><NotificationCenter initialItems={items||[]}/></main></div></div>;
  }

  const companyMembership:any=rows.find((m:any)=>m.organizations?.organization_type!=="accounting"&&m.role!=="accountant")||rows[0];
  const org:any=companyMembership?{organization_id:companyMembership.organization_id,role:companyMembership.role,...companyMembership.organizations}:null;
  return <div className="app-shell"><header className="appbar"><div className="container appbar-in"><a className="brand" href="/app"><span className="logo">F</span><BrandWordmark/></a><CompanyHeaderMenu profile={profile} organization={org}/></div></header><main className="container notification-page-main user-notification-page"><a className="settings-back-link" href="/app"><ArrowLeft size={15}/> Nazad na početnu</a><div className="notification-page-head"><span className="pill"><Bell size={13}/> NOTIFIKACIJE</span><h1>Notifikacije</h1><p className="muted">Ovde su obaveštenja od knjigovođe, SUPER ADMIN-a i FiscalBox sistema.</p></div><NotificationCenter initialItems={items||[]}/></main></div>;
}
