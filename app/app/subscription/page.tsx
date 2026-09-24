import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import BrandWordmark from '@/components/BrandWordmark';
import SubscriptionManager from '@/components/SubscriptionManager';
import CompanyHeaderMenu from '@/components/CompanyHeaderMenu';
import AccountantDesktopMenu from '@/components/AccountantDesktopMenu';

export default async function SubscriptionPage({searchParams}:{searchParams:Promise<{organization_id?:string;checkout?:string;portal_error?:string}>}){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const sp=await searchParams;
  const [{data:profile},{data:memberships}]=await Promise.all([supabase.from('profiles').select('*').eq('user_id',user.id).single(),supabase.from('organization_members').select('organization_id,role,accounting_access_role,organizations(id,name,pib,organization_type,owner_user_id,plan,status,logo_path)').eq('user_id',user.id).in('role',['owner','employee'])]);
  const orgs=(memberships||[]).map((m:any)=>({...m,...m.organizations}));
  const org=sp.organization_id?orgs.find((o:any)=>String(o.organization_id)===sp.organization_id):orgs[0];
  if(!org)redirect('/app');
  const {data:subscription}=await supabase.from('subscriptions').select('*').eq('organization_id',org.organization_id).maybeSingle();
  const canManage=org.owner_user_id===user.id||(org.organization_type==='accounting'&&org.accounting_access_role==='admin');
  const isAccountant=profile?.global_role==='accountant'||org.organization_type==='accounting';
  const content=<><div className="app-head"><div><span className="pill">PRETPLATA</span><h1 className="company-name-heading">{org.name}</h1><p className="muted">Realna FiscalBox pretplata, status naplate i upravljanje paketom.</p></div></div>{sp.checkout==='return'&&<div className="home-message">Plaćanje je završeno ili zatvoreno. Status se automatski osvežava nakon potvrde payment providera; ako još piše PENDING, osvežite stranicu za nekoliko sekundi.</div>}{sp.portal_error&&<div className="error">Portal payment providera trenutno nije dostupan. Pokušajte ponovo.</div>}<SubscriptionManager organization={org} subscription={subscription||{plan:org.plan,status:'pending_checkout',seat_count:1}} canManage={canManage}/></>;
  if(isAccountant)return <div className="app-shell accountant-shell"><div className="accountant-desktop-layout"><AccountantDesktopMenu isAdmin={canManage} username={profile?.username||profile?.full_name||profile?.auth_email||''}/><main className="app-main accountant-main">{content}</main></div></div>;
  return <div className="app-shell"><header className="appbar"><div className="container appbar-in"><a className="brand" href="/app"><span className="logo">F</span><BrandWordmark/></a><CompanyHeaderMenu profile={profile} organization={org}/></div></header><main className="container app-main">{content}</main></div>;
}
