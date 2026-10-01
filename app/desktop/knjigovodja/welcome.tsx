"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowRight,
  BellRing,
  Check,
  FileCheck2,
  ReceiptText,
  ShieldCheck,
  Users,
  WalletCards,
} from "lucide-react";
import BrandWordmark from "@/components/BrandWordmark";

const STORAGE_KEY = "fiscalbox:knjigo-desktop-onboarding:v1";

const slides = [
  {
    eyebrow: "KLIJENTI",
    title: "Svi klijenti na jednom mestu",
    text: "Dodajte ili pozovite klijenta, izaberite mu BASIC ili PREMIUM paket i pratite njegovu dokumentaciju iz jednog KNJIGO dashboard-a.",
    icon: Users,
    bullets: ["Pretraga po nazivu i PIB-u", "Dodela klijenata zaposlenima", "Automatski predračun novom klijentu"],
  },
  {
    eyebrow: "PRIJEM",
    title: "Računi i dokumenti bez jurnjave",
    text: "Klijent šalje fiskalne račune i fajlove digitalno. FiscalBox ih prima, raspoređuje i jasno označava šta je novo i šta još nije obrađeno.",
    icon: FileCheck2,
    bullets: ["Preuzmi fiskalne", "Preuzmi dokumenta", "Arhiva po klijentu i periodu"],
  },
  {
    eyebrow: "PDV",
    title: "PDV podatak odmah uz račun",
    text: "Na računu vidite izvučen PDV iznos, PIB kupca i status validnosti. AI daje predlog, a knjigovođa zadržava konačnu odluku.",
    icon: ReceiptText,
    bullets: ["Konkretan PDV iznos", "AI predlog DA / NE / PROVERA", "Konačna potvrda knjigovođe"],
  },
  {
    eyebrow: "KONTROLA",
    title: "Manje poruka, više pregleda",
    text: "Notifikacije, mesečni pregled, štampa, preuzimanje i slanje dokumenta klijentu ostaju u jednoj aplikaciji.",
    icon: BellRing,
    bullets: ["Novi računi i dokumenti", "Štampa i download", "Digitalna arhiva i istorija"],
  },
];

export default function AccountantDesktopWelcome() {
  const router = useRouter();
  const [stage, setStage] = React.useState<"splash" | "intro">("splash");
  const [index, setIndex] = React.useState(0);
  const [returning, setReturning] = React.useState(false);

  React.useEffect(() => {
    let finished = false;
    try {
      finished = window.localStorage.getItem(STORAGE_KEY) === "done";
    } catch {}
    setReturning(finished);
    const timer = window.setTimeout(() => {
      if (finished) router.replace("/app");
      else setStage("intro");
    }, 1350);
    return () => window.clearTimeout(timer);
  }, [router]);

  function finish() {
    try { window.localStorage.setItem(STORAGE_KEY, "done"); } catch {}
    router.push("/app");
  }

  if (stage === "splash") {
    return (
      <main className="knjigo-desktop-splash" aria-label="FiscalBox KNJIGO pokretanje">
        <div className="knjigo-splash-glow" />
        <div className="knjigo-splash-logo">F</div>
        <div className="knjigo-splash-brand"><BrandWordmark /></div>
        <div className="knjigo-splash-role">KNJIGO</div>
        <p>{returning ? "Otvaram vaš dashboard…" : "Pametniji prijem računa i dokumentacije."}</p>
        <div className="knjigo-splash-progress"><span /></div>
      </main>
    );
  }

  const slide = slides[index];
  const Icon = slide.icon;
  const last = index === slides.length - 1;

  return (
    <main className="knjigo-desktop-welcome">
      <section className="knjigo-welcome-panel">
        <header className="knjigo-welcome-brand">
          <div className="knjigo-mini-logo">F</div>
          <div><BrandWordmark /><span>KNJIGO · Windows aplikacija</span></div>
        </header>

        <div className="knjigo-welcome-copy">
          <span className="knjigo-welcome-kicker">DOBRO DOŠLI</span>
          <h1>FiscalBox za knjigovođu.</h1>
          <p>Klijenti, fiskalni računi i dokumentacija stižu digitalno — bez donošenja papira i bez traženja po porukama.</p>
          <div className="knjigo-welcome-trust">
            <span><ShieldCheck size={17}/> Podaci ostaju vezani za vaš FiscalBox nalog</span>
            <span><WalletCards size={17}/> Knjigovođa nema svoju pretplatu</span>
            <span><Archive size={17}/> Sve ostaje u arhivi klijenta</span>
          </div>
        </div>
      </section>

      <section className="knjigo-onboarding-card" aria-live="polite">
        <div className="knjigo-onboarding-top">
          <span className="knjigo-step-count">{String(index + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</span>
          <button type="button" className="knjigo-skip" onClick={finish}>Preskoči prezentaciju</button>
        </div>
        <div className="knjigo-feature-icon"><Icon size={30}/></div>
        <span className="knjigo-feature-eyebrow">{slide.eyebrow}</span>
        <h2>{slide.title}</h2>
        <p>{slide.text}</p>
        <div className="knjigo-feature-list">
          {slide.bullets.map((item) => <div key={item}><Check size={16}/><span>{item}</span></div>)}
        </div>
        <div className="knjigo-onboarding-bottom">
          <div className="knjigo-dots" aria-hidden="true">
            {slides.map((_, i) => <span key={i} className={i === index ? "active" : ""}/>) }
          </div>
          <div className="knjigo-onboarding-actions">
            {index > 0 && <button type="button" className="btn" onClick={() => setIndex(index - 1)}>Nazad</button>}
            <button type="button" className="btn btn-primary" onClick={() => last ? finish() : setIndex(index + 1)}>
              {last ? "Pokreni FiscalBox" : "Dalje"} <ArrowRight size={17}/>
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
