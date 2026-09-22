import type { Metadata, Viewport } from "next";
import PwaRegister from "@/components/PwaRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "FiscalBox", template: "%s · FiscalBox" },
  description: "Skeniraj. Sačuvaj. Pošalji knjigovođi. Aplikacija za fiskalne račune i dokumenta.",
  applicationName: "FiscalBox",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
  appleWebApp: { capable: true, title: "FiscalBox", statusBarStyle: "default" }
};
export const viewport: Viewport = { themeColor: "#0D382B" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="sr"><body><PwaRegister/>{children}</body></html>;
}
