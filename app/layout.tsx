import type { Metadata, Viewport } from "next";
import PwaRegister from "@/components/PwaRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fiskalni Inbox",
  description: "Digitalni inbox fiskalnih računa za firme i knjigovođe.",
  applicationName: "Fiskalni Inbox",
  appleWebApp: { capable: true, title: "Fiskalni Inbox", statusBarStyle: "default" }
};
export const viewport: Viewport = { themeColor: "#0f6b4f" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="sr"><body><PwaRegister/>{children}</body></html>;
}
