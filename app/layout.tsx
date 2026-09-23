import type { Metadata, Viewport } from "next";
import PwaRegister from "@/components/PwaRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "FiscalBox", template: "%s · FiscalBox" },
  description: "Skeniraj. Sačuvaj. Pošalji knjigovođi. Aplikacija za fiskalne račune i dokumenta.",
  applicationName: "FiscalBox",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
  appleWebApp: { capable: true, title: "FiscalBox", statusBarStyle: "default" }
};

export const viewport: Viewport = { themeColor: "#0D382B" };

const pwaBootstrap = `
(function () {
  if (window.__fiscalBoxPwaBootstrap) return;
  window.__fiscalBoxPwaBootstrap = true;
  window.__fiscalBoxInstallPrompt = window.__fiscalBoxInstallPrompt || null;

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    window.__fiscalBoxInstallPrompt = event;
    window.dispatchEvent(new Event('fiscalbox:pwa-install-ready'));
  });

  window.addEventListener('appinstalled', function () {
    window.__fiscalBoxInstalled = true;
    window.__fiscalBoxInstallPrompt = null;
    window.dispatchEvent(new Event('fiscalbox:pwa-state'));
  });
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sr">
      <body>
        <script dangerouslySetInnerHTML={{ __html: pwaBootstrap }} />
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
