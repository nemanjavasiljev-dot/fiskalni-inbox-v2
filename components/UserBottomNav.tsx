"use client";

import { FileText, Home, MoreHorizontal, QrCode, Search } from "lucide-react";

type NavKey = "home" | "search" | "files" | "more";

export default function UserBottomNav({
  active = "home", onHome, onSearch, onScan, onFiles, onMore, scanDisabled = false
}: {
  active?: NavKey;
  onHome: () => void;
  onSearch: () => void;
  onScan: () => void;
  onFiles: () => void;
  onMore: () => void;
  scanDisabled?: boolean;
}) {
  const item = (key: NavKey, label: string, Icon: any, action: () => void) => (
    <button type="button" className={`user-bottom-item ${active === key ? "active" : ""}`} onClick={action} aria-label={label}>
      <Icon size={21} strokeWidth={2.1}/><span>{label}</span>
    </button>
  );
  return <nav className="user-bottom-nav" aria-label="Glavni meni korisnika">
    {item("home","Home",Home,onHome)}
    {item("search","Pretraga",Search,onSearch)}
    <button type="button" className="user-bottom-scan" onClick={onScan} disabled={scanDisabled} aria-label="Otvori QR skener"><span className="user-bottom-scan-circle"><QrCode size={29} strokeWidth={2.4}/></span><span>Skeniraj</span></button>
    {item("files","Fajlovi",FileText,onFiles)}
    {item("more","Više",MoreHorizontal,onMore)}
  </nav>;
}
