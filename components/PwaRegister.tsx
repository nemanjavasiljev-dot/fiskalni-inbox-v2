"use client";

import React from "react";

type FiscalBoxWindow = Window & typeof globalThis & {
  __fiscalBoxSwReady?: boolean;
};

export default function PwaRegister() {
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;

    async function ensureRegistration() {
      try {
        let registration = await navigator.serviceWorker.getRegistration("/");
        if (!registration) registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
        if (cancelled) return;
        (window as FiscalBoxWindow).__fiscalBoxSwReady = true;
        registration.update().catch(() => {});
        window.dispatchEvent(new Event("fiscalbox:pwa-state"));
      } catch (error) {
        console.error("FiscalBox service worker registration failed", error);
      }
    }

    ensureRegistration();
    return () => { cancelled = true; };
  }, []);

  return null;
}
