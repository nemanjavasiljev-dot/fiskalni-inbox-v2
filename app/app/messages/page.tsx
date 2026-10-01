import { redirect } from "next/navigation";
import { ArrowLeft, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import BrandWordmark from "@/components/BrandWordmark";
import CompanyHeaderMenu from "@/components/CompanyHeaderMenu";
import AccountantDesktopMenu from "@/components/AccountantDesktopMenu";
import MessageCenter from "@/components/MessageCenter";

export default async function MessagesPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
  const [{data:profile},{data:memberships},{data:items}]=await Promise.all([
    supabase.from("profiles").select("*").eq("user_id",user.id).single(),
    supabase.from("organization_members").select("organization_id,role,accounting_access_role,organizations(id,name,pib,logo_path,owner_user_id,organization_type)").eq("user_id",user.id),
    supabase.from("user_messages").select("*").or(`sender_user_id.eq.${user.id},recipient_user_id.eq.${user.id}`).order("created_at",{ascending:false}).limit(200)
  ]);
  if(!profile)redirect("/login");
  const rows=memberships||[];const accountingMembership:any=rows.find((m:any)=>m.organizations?.organization_type==="accounting"&&["owner","employee"].includes(m.role));const isAccountant=profile.global_role==="accountant"&&Boolean(accountingMembership);
  if(isAccountant){const office:any=accountingMembership?.organizations||{};const isAdmin=(accountingMembership.role==="owner"&&String(office.owner_user_id)===String(user.id))||accountingMembership.accounting_access_role==="admin";return <div className="app-shell accountant-shell"><div className="accountant-desktop-layout"><AccountantDesktopMenu isAdmin={isAdmin} username={profile.full_name||profile.username||profile.auth_email||""}/><main className="accountant-main message-page-main"><div className="app-head message-page-head"><div><span className="pill"><Mail size={13}/> PORUKE</span><h1>Inbox</h1><p className="muted">Primljene, poslate i nepročitane poruke klijenata i FiscalBox administracije.</p></div></div><MessageCenter initialItems={items||[]} currentUserId={user.id}/></main></div></div>}
  const companyMembership:any=rows.find((m:any)=>m.organizations?.organization_type!=="accounting"&&m.role!=="accountant")||rows[0];const org:any=companyMembership?{organization_id:companyMembership.organization_id,role:companyMembership.role,...companyMembership.organizations}:null;
  return <div className="app-shell"><header className="appbar"><div className="container appbar-in"><a className="brand" href="/app"><span className="logo">F</span><BrandWordmark/></a><CompanyHeaderMenu profile={profile} organization={org}/></div></header><main className="container message-page-main user-message-page"><a className="settings-back-link" href="/app"><ArrowLeft size={15}/> Nazad na početnu</a><div className="message-page-head"><span className="pill"><Mail size={13}/> PORUKE</span><h1>Inbox</h1><p className="muted">Primljene, poslate i nepročitane poruke. Ovde možete i direktno da odgovorite knjigovođi.</p></div><MessageCenter initialItems={items||[]} currentUserId={user.id}/></main></div>;
}
