"use client";

import React from "react";
import { Bell, BriefcaseBusiness, CreditCard, Download, FileText, LayoutDashboard, Mail, Menu, Settings, Users, X } from "lucide-react";
import { usePathname } from "next/navigation";
import BrandWordmark from "@/components/BrandWordmark";
import PushNotificationOptIn from "@/components/PushNotificationOptIn";
import CommunicationQuickActions from "@/components/CommunicationQuickActions";

export default function AccountantDesktopMenu({
  isAdmin = false,
  username = "",
  notificationCount = 0,
  onNotificationsClick
}: {
  isAdmin?: boolean;
  username?: string;
  notificationCount?: number;
  onNotificationsClick?: () => void;
}) {
  const pathname = usePathname();
  const [mobileOpen,setMobileOpen]=React.useState(false);
  React.useEffect(()=>{setMobileOpen(false)},[pathname]);

  const links = [
    { href: "/app", label: "Pregled", icon: LayoutDashboard, active: pathname === "/app" },
    { href: "/app#clients", label: "Moji klijenti", icon: BriefcaseBusiness, active: false },
    { href: "/app/billing", label: "Moji računi", icon: FileText, active: pathname === "/app/billing" },
    { href: "/app/subscription", label: "Pretplata", icon: CreditCard, active: pathname === "/app/subscription" },
    { href: "/app/messages", label: "Poruke", icon: Mail, active: pathname === "/app/messages" },
    { href: "/app/notifications", label: "Notifikacije", icon: Bell, active: pathname === "/app/notifications" },
    ...(isAdmin ? [{ href: "/app/accountant/settings?tab=staff", label: "Moji zaposleni", icon: Users, active: false }] : []),
    { href: "/app/accountant/settings?tab=profile", label: "Podešavanja", icon: Settings, active: false },
    { href: "/app/accountant/settings?tab=install", label: "Instaliraj app", icon: Download, active: false }
  ];

  return <>
    {mobileOpen&&<button type="button" className="accountant-mobile-backdrop" aria-label="Zatvori meni" onClick={()=>setMobileOpen(false)}/>}
    <div className="accountant-mobile-topbar">
      <button type="button" className="accountant-mobile-menu-inline" onClick={()=>setMobileOpen(true)}><Menu size={20}/><span>Meni</span></button>
      <a href="/app" className="accountant-mobile-brand"><span className="accountant-mobile-logo">F</span><BrandWordmark suffix=" · KNJIGO"/></a>
      <CommunicationQuickActions compact className="accountant-mobile-communications"/>
    </div>

    <aside className={`accountant-desktop-menu accountant-super-menu ${mobileOpen?"mobile-open":""}`}>
      <div className="accountant-menu-head">
        <a href="/app" className="accountant-menu-brand"><span className="logo">F</span><BrandWordmark/></a>
        <button type="button" className="accountant-menu-mobile-toggle" aria-label="Zatvori meni" onClick={()=>setMobileOpen(false)}><X size={22}/></button>
      </div>
      <div className="accountant-menu-user"><span>{isAdmin?"ADMIN KNJIGOVOĐA":"KNJIGOVOĐA"}</span><b>{username||"FiscalBox KNJIGO"}</b></div><CommunicationQuickActions className="accountant-sidebar-communications"/>
      <nav>{links.map(({ href, label, icon: Icon, active }) => <a key={href} href={href} className={active ? "active" : ""}><Icon size={18}/><span>{label}</span>{label==="Notifikacije"&&notificationCount>0&&<em>{notificationCount}</em>}</a>)}</nav>
      <div className="accountant-menu-push"><PushNotificationOptIn/></div>
      <form method="post" action="/api/auth/logout"><button type="submit" className="accountant-menu-logout">Odjava</button></form>
    </aside>
  </>;
}
