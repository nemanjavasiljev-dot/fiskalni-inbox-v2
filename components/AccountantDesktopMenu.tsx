"use client";

import { Bell, BriefcaseBusiness, Download, FileText, LayoutDashboard, Settings, Users } from "lucide-react";
import { usePathname } from "next/navigation";

export default function AccountantDesktopMenu({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const links = [
    { href: "/app", label: "Pregled", icon: LayoutDashboard, active: pathname === "/app" },
    { href: "/app#clients", label: "Moji klijenti", icon: BriefcaseBusiness, active: false },
    { href: "/app/billing", label: "Moji racuni", icon: FileText, active: pathname === "/app/billing" },
    { href: "/app/accountant/settings?tab=notifications", label: "Notifikacije", icon: Bell, active: pathname.includes("/accountant/settings") },
    ...(isAdmin ? [{ href: "/app/accountant/settings?tab=staff", label: "Moji zaposleni", icon: Users, active: false }] : []),
    { href: "/app/accountant/settings?tab=profile", label: "Podesavanja", icon: Settings, active: false },
    { href: "/app/accountant/settings?tab=install", label: "Instaliraj app", icon: Download, active: false }
  ];
  return <aside className="accountant-desktop-menu">
    <div className="accountant-menu-title">MENI</div>
    <nav>{links.map(({ href, label, icon: Icon, active }) => <a key={href} href={href} className={active ? "active" : ""}><Icon size={18}/><span>{label}</span></a>)}</nav>
    <form method="post" action="/api/auth/logout"><button type="submit" className="accountant-menu-logout">Odjava</button></form>
  </aside>;
}
