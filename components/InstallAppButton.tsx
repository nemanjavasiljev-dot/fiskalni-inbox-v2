"use client";

import React from "react";
import { CheckCircle2, Download, MonitorDown, X } from "lucide-react";

type InstallChoice = { outcome: "accepted" | "dismissed"; platform?: string };
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};
type FiscalBoxWindow = Window & typeof globalThis & {
  __fiscalBoxInstallPrompt?: InstallPromptEvent | null;
  __fiscalBoxInstalled?: boolean;
};

function getAppWindow() {
  return window as FiscalBoxWindow;
}

function isStandalone() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function browserName() {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("edg/")) return "edge";
  if (ua.includes("chrome/") || ua.includes("crios/")) return "chrome";
  if (ua.includes("firefox/")) return "firefox";
  if (ua.includes("safari/") && !ua.includes("chrome/") && !ua.includes("crios/")) return "safari";
  return "other";
}

function manualHelp() {
  const browser = browserName();
  if (browser === "edge") {
    return {
      title: "Instalacija u Microsoft Edge-u",
      text: "Ako se sistemski prozor nije otvorio, kliknite na ⋯ gore desno → Apps → Install FiscalBox / Install this site as an app.",
    };
  }
  if (browser === "chrome") {
    return {
      title: "Instalacija u Google Chrome-u",
      text: "Ako se sistemski prozor nije otvorio, kliknite na ikonicu za instalaciju u desnom delu adresne linije ili ⋮ → Cast, save and share → Install FiscalBox.",
    };
  }
  if (browser === "safari") {
    return {
      title: "Instalacija u Safari-ju",
      text: "Na macOS-u koristite File → Add to Dock. Na iPhone/iPad uređaju koristite Share → Add to Home Screen.",
    };
  }
  if (browser === "firefox") {
    return {
      title: "Instalacija iz Firefox-a",
      text: "Ako Firefox na ovom računaru ne nudi instalaciju web aplikacije, otvorite FiscalBox u Microsoft Edge-u ili Google Chrome-u i kliknite Instaliraj. Nalog i podaci ostaju isti.",
    };
  }
  return {
    title: "Instalacija FiscalBox aplikacije",
    text: "Otvorite meni pregledača i izaberite Install app, Install this site as an app, Add to Dock ili Add to Home Screen. Za Windows preporučujemo Edge ili Chrome.",
  };
}

export default function InstallAppButton({ compact = false }: { compact?: boolean }) {
  const [installed, setInstalled] = React.useState(false);
  const [available, setAvailable] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [showHelp, setShowHelp] = React.useState(false);
  const [message, setMessage] = React.useState("");

  const syncState = React.useCallback(() => {
    const w = getAppWindow();
    const done = isStandalone() || w.__fiscalBoxInstalled === true;
    setInstalled(done);
    setAvailable(Boolean(w.__fiscalBoxInstallPrompt));
  }, []);

  React.useEffect(() => {
    syncState();

    const onReady = () => syncState();
    const onInstalled = () => {
      const w = getAppWindow();
      w.__fiscalBoxInstalled = true;
      w.__fiscalBoxInstallPrompt = null;
      setInstalled(true);
      setAvailable(false);
      setBusy(false);
      setMessage("FiscalBox je instaliran na ovom uređaju.");
    };
    const onPrompt = (event: Event) => {
      const prompt = event as InstallPromptEvent;
      prompt.preventDefault();
      const w = getAppWindow();
      w.__fiscalBoxInstallPrompt = prompt;
      setAvailable(true);
    };

    window.addEventListener("fiscalbox:pwa-install-ready", onReady);
    window.addEventListener("fiscalbox:pwa-state", onReady);
    window.addEventListener("appinstalled", onInstalled);
    // Rezervni listener ako je komponenta montirana pre globalnog PWA bootstrap-a.
    window.addEventListener("beforeinstallprompt", onPrompt);

    return () => {
      window.removeEventListener("fiscalbox:pwa-install-ready", onReady);
      window.removeEventListener("fiscalbox:pwa-state", onReady);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, [syncState]);

  async function install() {
    if (installed) {
      setMessage("FiscalBox je već instaliran na ovom uređaju.");
      setShowHelp(true);
      return;
    }

    setMessage("");
    const w = getAppWindow();
    const prompt = w.__fiscalBoxInstallPrompt;

    if (prompt) {
      setBusy(true);
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        // Chromium dozvoljava korišćenje jednog prompt događaja samo jednom.
        w.__fiscalBoxInstallPrompt = null;
        setAvailable(false);

        if (choice.outcome === "accepted") {
          setMessage("Instalacija je pokrenuta. FiscalBox će se pojaviti među aplikacijama.");
        } else {
          setMessage("Instalacija je otkazana. Možete je pokrenuti ponovo iz menija pregledača.");
          setShowHelp(true);
        }
      } catch (error) {
        console.error("FiscalBox PWA install prompt failed", error);
        setMessage("Pregledač nije otvorio prozor za instalaciju. Koristite uputstvo ispod.");
        setShowHelp(true);
      } finally {
        setBusy(false);
      }
      return;
    }

    // Browser još nije izdao beforeinstallprompt ili ga ne podržava.
    // Dugme i dalje mora da uradi nešto korisno: prikazuje precizno uputstvo.
    setShowHelp(true);
  }

  const help = typeof navigator !== "undefined" ? manualHelp() : { title: "Instalacija FiscalBox-a", text: "" };

  return (
    <div className={`install-app-block ${compact ? "compact" : ""}`}>
      <button
        type="button"
        className={`btn ${compact ? "btn-install-compact" : "btn-primary"}`}
        onClick={install}
        disabled={busy}
        aria-label="Instaliraj FiscalBox kao desktop aplikaciju"
      >
        {installed ? <CheckCircle2 size={17} /> : <Download size={17} />}
        {busy
          ? "Otvaram instalaciju…"
          : installed
            ? "FiscalBox je instaliran"
            : compact
              ? "Instaliraj za računar"
              : "Instaliraj FiscalBox"}
      </button>

      {!compact && available && !installed && (
        <div className="install-ready"><span /> Spremno za instalaciju</div>
      )}

      {message && !showHelp && <p className="muted install-help-inline">{message}</p>}

      {showHelp && (
        <div className="install-modal-backdrop" role="presentation" onMouseDown={() => setShowHelp(false)}>
          <div className="install-modal" role="dialog" aria-modal="true" aria-label="Instalacija FiscalBox-a" onMouseDown={(e) => e.stopPropagation()}>
            <button type="button" className="install-modal-close" onClick={() => setShowHelp(false)} aria-label="Zatvori"><X size={18} /></button>
            <div className="install-modal-icon"><MonitorDown size={26} /></div>
            <span className="pill">DESKTOP APP</span>
            <h3>{installed ? "FiscalBox je već instaliran" : help.title}</h3>
            {message && <p className="install-modal-message">{message}</p>}
            {!installed && <p className="muted">{help.text}</p>}
            {!installed && (
              <p className="muted install-modal-note">
                Direktni sistemski prozor za instalaciju može da se otvori samo kada ga pregledač dozvoli. FiscalBox sada čuva install prompt čim ga Chrome/Edge ponude, pa oba dugmeta na početnoj strani koriste isti pouzdani instalacioni mehanizam.
              </p>
            )}
            <div className="actions install-modal-actions">
              {!installed && (
                <button type="button" className="btn btn-primary" onClick={() => { setShowHelp(false); window.location.reload(); }}>
                  Osveži stranicu i pokušaj ponovo
                </button>
              )}
              <button type="button" className="btn" onClick={() => setShowHelp(false)}>Zatvori</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
