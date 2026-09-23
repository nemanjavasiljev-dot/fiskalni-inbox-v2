"use client";

import React from "react";

export default function PwaRegister() {
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    async function register() {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
        if (cancelled) return;

        // Proveri novu verziju SW-a bez čekanja na sledeću posetu.
        registration.update().catch(() => {});
        window.dispatchEvent(new Event("fiscalbox:pwa-state"));
      } catch (error) {
        console.error("FiscalBox service worker registration failed", error);
      }
    }

    register();
    return () => { cancelled = true; };
  }, []);

  return null;
}
