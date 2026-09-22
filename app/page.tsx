import Link from "next/link";
import InstallAppButton from "@/components/InstallAppButton";

export default function Landing() {
  return (
    <>
      <header className="nav">
        <div className="container navin">
          <Link className="brand" href="/">
            <span className="logo">F</span><span>Fiskalni Inbox</span>
          </Link>
          <nav className="navlinks">
            <a href="#kako">Kako radi</a>
            <a href="#funkcije">Funkcije</a>
            <a href="#cene">Pretplate</a>
          </nav>
          <div className="actions">
            <Link className="btn" href="/login">Prijava</Link>
            <Link className="btn btn-primary" href="/register">Registruj se</Link>
            <Link className="btn btn-accent" href="/login?demo=1">Pokreni demo</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="container hero-grid">
            <div>
              <span className="pill">DIGITALNI INBOX ZA FISKALNE RAČUNE</span>
              <h1>Račun od kase do knjigovođe za nekoliko sekundi.</h1>
              <p className="muted">
                Zaposleni skenira QR kod sa fiskalnog računa. Fiskalni Inbox ga
                proverava, evidentira i stavlja na raspolaganje firmi i knjigovođi —
                bez fascikli, slanja fotografija i mesečnog traženja računa.
              </p>
              <div className="hero-actions">
                <Link className="btn btn-primary" href="/register">Registruj se</Link>
                <Link className="btn btn-accent" href="/login?demo=1">Isprobaj demo</Link>
                <a className="btn" href="#cene">Pogledaj pretplate</a>
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
                ["⌗","QR skeniranje","Brz unos fiskalnog računa direktno sa telefona."],
                ["✓","Provera računa","Server proverava da QR vodi na dozvoljeni domen Poreske uprave."],
                ["⌕","Pretraga","Dobavljač, PIB, broj računa, kategorija i period."],
                ["⇩","CSV izvoz","Podaci spremni za dalju obradu i knjigovodstvo."],
                ["▧","Štampa / PDF","Print-friendly prikaz svakog računa i mesečnog pregleda."],
                ["◎","Više klijenata","Knjigovođa iz jednog naloga pristupa svim dodeljenim firmama."]
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
            <div className="section-head" style={{textAlign:"center",margin:"0 auto 32px"}}><span className="pill">PRETPLATE</span><h2>Jednostavna cena po korisniku.</h2><p className="muted">Mesečna pretplata. Cena se množi brojem aktivnih korisnika naloga.</p></div>
            <div className="grid pricing pricing-three">
              <div className="card price">
                <span className="tag">10 DANA</span><h3>Probni</h3><div className="price-number">0 RSD</div><div className="muted">10 dana besplatno</div>
                <ul><li>Bez obaveze</li><li>QR i fajlovi</li><li>Povezivanje knjigovođe</li><li>Test svih osnovnih funkcija</li></ul>
                <Link href="/register" className="btn btn-primary" style={{width:"100%"}}>Počni besplatno</Link>
              </div>
              <div className="card price">
                <h3>Basic</h3><div className="price-number">1.250 RSD</div><div className="muted">po korisniku / mesečno</div>
                <ul><li>QR unos računa</li><li>Baza i pretraga</li><li>Kategorije i napomene</li><li>CSV izvoz</li><li>Pristup knjigovođi</li></ul>
                <Link href="/register" className="btn btn-primary" style={{width:"100%"}}>Izaberi Basic</Link>
              </div>
              <div className="card price pop">
                <span className="tag">PREPORUČENO</span><h3>Premium</h3><div className="price-number">2.000 RSD</div><div className="muted">po korisniku / mesečno</div>
                <ul><li>Sve iz Basic paketa</li><li>Napredni mesečni pregledi</li><li>Print/PDF paketi</li><li>Više firmi za knjigovođe</li><li>Prioritetna podrška</li></ul>
                <Link href="/register" className="btn btn-accent" style={{width:"100%"}}>Izaberi Premium</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="card" style={{padding:32,display:"flex",alignItems:"center",justifyContent:"space-between",gap:24,flexWrap:"wrap"}}>
              <div><span className="pill">DESKTOP APP</span><h2 style={{margin:"10px 0 6px"}}>Fiskalni Inbox kao aplikacija na računaru.</h2><p className="muted" style={{margin:0}}>Instalacija je dostupna kroz Chrome, Edge i Firefox Web Apps na podržanom Windows-u.</p></div>
              <InstallAppButton/>
            </div>
          </div>
        </section>

        <div className="container">
          <div className="cta">
            <div><h2>Probaj Fiskalni Inbox.</h2><p style={{color:"#cde1d8"}}>Demo nalozi su odvojeni od produkcionih podataka.</p></div>
            <div className="actions"><Link className="btn btn-primary" href="/register">Registruj se</Link><Link className="btn btn-accent" href="/login?demo=1">Pokreni demo</Link><Link className="btn" href="/login">Prijava</Link></div>
          </div>
        </div>
      </main>

      <footer className="footer"><div className="container">© 2026 Fiskalni Inbox · Digitalna evidencija fiskalnih računa</div></footer>
    </>
  );
}
