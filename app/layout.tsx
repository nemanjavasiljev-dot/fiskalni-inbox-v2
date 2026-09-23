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

/*
 * Listener mora da bude u <head>-u, pre hidratacije React-a. Chromium ume da
 * emituje beforeinstallprompt veoma rano; ako ga propustimo, dugme ne može da
 * otvori nativni install dijalog do sledeće procene installability-ja.
 */
const pwaBootstrap = `
(function () {
  if (window.__fiscalBoxPwaBootstrap) return;
  window.__fiscalBoxPwaBootstrap = true;
  window.__fiscalBoxInstallPrompt = window.__fiscalBoxInstallPrompt || null;
  window.__fiscalBoxInstalled = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;

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

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(function (registration) {
        registration.update().catch(function () {});
        return navigator.serviceWorker.ready;
      })
      .then(function () {
        window.__fiscalBoxSwReady = true;
        window.dispatchEvent(new Event('fiscalbox:pwa-state'));
      })
      .catch(function (error) {
        console.error('FiscalBox early service worker registration failed', error);
      });
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sr">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <script dangerouslySetInnerHTML={{ __html: pwaBootstrap }} />
      </head>
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
