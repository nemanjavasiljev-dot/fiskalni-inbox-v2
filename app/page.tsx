import Link from "next/link";
import InstallAppButton from "@/components/InstallAppButton";
import BrandWordmark from "@/components/BrandWordmark";
import LegalLinks from "@/components/LegalLinks";

export default function Landing() {
  return (
    <>
      <header className="nav">
        <div className="container navin">
          <Link className="brand landing-brand" href="/">
            <span className="logo">F</span><BrandWordmark/>
          </Link>
          <nav className="navlinks">
            <a href="#kako">Kako radi</a>
            <a href="#funkcije">Funkcije</a>
            <a href="#cene">Pretplate</a>
          </nav>
          <div className="actions landing-actions">
            <Link className="btn landing-login" href="/login">Prijava</Link>
            <Link className="btn btn-primary landing-register" href="/register">Registruj se</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="container hero-grid">
            <div>
              <span className="pill">APLIKACIJA ZA FISKALNE RAČUNE I DOKUMENTA</span>
              <h1>Manje papira.<br/><span className="hero-accent">Više kontrole.</span></h1>
              <p className="hero-brand-tagline">Skeniraj. Sačuvaj. Pošalji knjigovođi.</p>
              <p className="muted hero-brand-copy">FiscalBox povezuje firmu i knjigovođu u jednom sigurnom digitalnom prostoru. Fiskalni računi, dokumenti, pretraga, arhiva i slanje knjigovođi — bez fascikli i mesečnog traženja papira.</p>
              <div className="hero-actions hero-actions-clean">
                <Link className="btn btn-primary" href="/register">Registruj se</Link>
                <Link className="btn" href="/login">Prijava</Link>
              </div>
            </div>

            <div className="preview">
              <div className="preview-top">
                <div><b>Pregled septembra</b><div style={{color:"#91a79d",fontSize:12}}>Cybershield doo</div></div>
                <span className="dot" />
              </div>
              <div className="metric-row">
                <div className="metric"><span>RAČUNI</span><strong>48</strong></div>
                <div className="metric"><span>TROŠKOVI</span><strong>318k</strong></div>
                <div className="metric"><span>PDV</span><strong>52k</strong></div>
              </div>
              <div className="receipt-mini">
                <div className="receipt-line"><span>NIS Petrol</span><b>8.420 RSD</b></div>
                <div className="receipt-line"><span>Gigatron</span><b>32.990 RSD</b></div>
                <div className="receipt-line"><span>Telekom Srbija</span><b>14.280 RSD</b></div>
              </div>
            </div>
          </div>
        </section>

        <section className="trial-promo-section" aria-label="Besplatan probni period">
          <div className="container">
            <div className="trial-promo-card">
              <div className="trial-promo-badge">10 DANA BESPLATNO</div>
              <div className="trial-promo-copy">
                <strong>Prvih 10 dana koristite FiscalBox besplatno.</strong>
                <span>Otvorite nalog i isprobajte funkcije izabranog paketa bez obaveze. Pretplatu birate tek nakon probnog perioda.</span>
              </div>
              <div className="trial-promo-note">Bez demo naloga · pravi podaci · puni pristup funkcijama</div>
            </div>
          </div>
        </section>

        <section id="kako" className="section">
          <div className="container">
            <div className="section-head">
              <span className="pill">KAKO RADI</span>
              <h2>Tri koraka umesto mesečnog haosa.</h2>
            </div>
            <div className="grid steps">
              <div className="card step"><b>1</b><h3>Skeniraj QR</h3><p className="muted">Kamera telefona čita QR kod sa fiskalnog računa.</p></div>
              <div className="card step"><b>2</b><h3>Automatska evidencija</h3><p className="muted">Dobavljač, PIB, datum, iznos i PDV ulaze u digitalnu bazu.</p></div>
              <div className="card step"><b>3</b><h3>Knjigovođa preuzima</h3><p className="muted">Pretraga, CSV, štampa i mesečni pregled dostupni su odmah.</p></div>
            </div>
          </div>
        </section>

        <section id="funkcije" className="section">
          <div className="container">
            <div className="section-head"><span className="pill">FUNKCIJE</span><h2>Napravljeno za firmu i knjigovođu.</h2></div>
            <div className="grid features">
              {[
                ["⌗","Skeniraj","Fiskalne račune u sekundi, direktno sa telefona."],
                ["⇧","Sačuvaj","Računi i dokumenti su bezbedno sačuvani na jednom mestu."],
                ["➤","Pošalji knjigovođi","Ručno ili automatski prosledi račun i dokumente knjigovođi."],
                ["✓","Pouzdano","Privatni podaci, kontrolisan pristup i pregled statusa."],
                ["⌕","Pretraga i arhiva","Dobavljač, PIB, kategorija, period i mesečna arhiva."],
                ["◎","Firma + knjigovođa","Jedna aplikacija za svakodnevni rad obe strane."]
              ].map(([i,t,d]) => (
                <div className="card feature" key={t}><div className="icon">{i}</div><h3>{t}</h3><p>{d}</p></div>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container grid role-grid">
            <div className="card role"><span className="pill">ZA FIRMU</span><h2>Računi više ne ostaju po kolima i džepovima.</h2><ul><li>Zaposleni odmah skenira račun</li><li>Jedinstvena baza svih troškova</li><li>Kategorije i napomene</li><li>Direktan pristup knjigovođi</li></ul></div>
            <div className="card role"><span className="pill">ZA KNJIGOVOĐU</span><h2>Svi klijenti u jednom urednom inbox-u.</h2><ul><li>Lista firmi i računa</li><li>Filteri po mesecu i dobavljaču</li><li>CSV i štampa</li><li>Manje poruka, fotografija i nedostajućih računa</li></ul></div>
          </div>
        </section>

        <section id="cene" className="section">
          <div className="container">
            <div className="section-head" style={{textAlign:"center",margin:"0 auto 32px"}}><span className="pill">PRETPLATE</span><h2>Jednostavna cena po korisniku.</h2><p className="muted">Basic i Premium imaju probni period od 10 dana. Posle trial-a aktivira se realna mesečna pretplata po broju aktivnih korisnika naloga.</p></div>
            <div className="grid pricing">
              <div className="card price">
                <span className="tag">10 DANA BESPLATNO</span><h3>Basic</h3><div className="price-number">1.250 RSD + PDV</div><div className="muted">po korisniku / mesečno nakon trial-a</div>
                <ul><li>QR unos računa</li><li>Fajlovi i arhiva</li><li>Kategorije i pretraga</li><li>CSV / PDF / štampa</li><li>Povezivanje knjigovođe</li></ul>
                <div className="pricing-actions"><Link href="/register?plan=basic&trial=1" className="btn btn-primary">Registruj se</Link><Link href="/register?plan=basic&trial=0" className="btn">Pretplati se</Link></div>
              </div>
              <div className="card price pop">
                <span className="tag">PREPORUČENO · 10 DANA BESPLATNO</span><h3>Premium</h3><div className="price-number">1.790 RSD + PDV</div><div className="muted">po korisniku / mesečno nakon trial-a</div>
                <ul><li>Sve iz Basic paketa</li><li>Napredni mesečni pregledi</li><li>Print/PDF paketi</li><li>Napredne KNJIGO funkcije</li><li>Prioritetne funkcije i podrška</li></ul>
                <div className="pricing-actions"><Link href="/register?plan=premium&trial=1" className="btn btn-brand-green">Registruj se</Link><Link href="/register?plan=premium&trial=0" className="btn">Pretplati se</Link></div>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="card" style={{padding:32,display:"flex",alignItems:"center",justifyContent:"space-between",gap:24,flexWrap:"wrap"}}>
              <div><span className="pill">DESKTOP APP</span><h2 style={{margin:"10px 0 6px"}}>FiscalBox kao aplikacija na računaru.</h2><p className="muted" style={{margin:0}}>Instalirajte FiscalBox kao desktop web aplikaciju. Na Windows-u preporučujemo Microsoft Edge ili Google Chrome za direktnu instalaciju.</p></div>
              <InstallAppButton/>
            </div>
          </div>
        </section>

        <div className="container">
          <div className="cta">
            <div><h2>Prvih 10 dana je besplatno.</h2><p style={{color:"#cde1d8"}}>Registrujte se, koristite FiscalBox sa pravim podacima i izaberite pretplatu kada završite probni period.</p></div>
            <div className="actions"><Link className="btn btn-brand-green" href="/register">Registruj se</Link><Link className="btn" href="/login">Prijava</Link></div>
          </div>
        </div>
      </main>

      <footer className="footer"><div className="container footer-inner"><div>© 2026 FiscalBox · OSKAR ZOMBORI PR ALSET CO.</div><LegalLinks className="footer-legal"/></div></footer>
    </>
  );
}
