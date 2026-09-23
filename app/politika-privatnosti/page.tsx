import type { Metadata } from "next";
import Link from "next/link";
import BrandWordmark from "@/components/BrandWordmark";
import LegalLinks from "@/components/LegalLinks";

export const metadata: Metadata = {
  title: "Politika privatnosti",
  description: "Politika privatnosti FiscalBox aplikacije."
};

export default function PrivacyPage(){
  return <main className="legal-shell"><div className="legal-wrap">
    <div className="legal-head"><Link className="brand" href="/"><span className="logo">F</span><BrandWordmark/></Link><Link className="btn" href="/">Nazad na FiscalBox</Link></div>
    <article className="card legal-card">
      <span className="pill">PRIVATNOST I ZAŠTITA PODATAKA</span>
      <h1>Politika privatnosti</h1>
      <p className="muted">Poslednje ažuriranje: 23. septembar 2026.</p>

      <div className="legal-meta">
        <div><span>Rukovalac / pružalac usluge</span><b>OSKAR ZOMBORI PR ALSET CO.</b></div>
        <div><span>Vlasnik</span><b>Oskar Zombori</b></div>
        <div><span>PIB</span><b>115266735</b></div>
        <div><span>Matični broj</span><b>68230403</b></div>
        <div><span>Sedište</span><b>Sterijina 29, sprat 2, stan 13, 24000 Subotica, Srbija</b></div>
        <div><span>Datum osnivanja</span><b>17. septembar 2025.</b></div>
      </div>

      <div className="legal-note">Ovaj dokument predstavlja produkcioni nacrt politike privatnosti za FiscalBox i treba ga uskladiti sa stvarnim ugovorima sa procesorima podataka, hostingom, servisom naplate i servisima za slanje poruka pre konačne pravne objave.</div>

      <h2>1. Na koga se politika odnosi</h2>
      <p>Ova politika objašnjava kako FiscalBox obrađuje podatke korisnika aplikacije, registrovanih firmi, knjigovođa, zaposlenih i drugih ovlašćenih lica koja koriste FiscalBox veb ili instaliranu PWA aplikaciju.</p>

      <h2>2. Koje podatke obrađujemo</h2>
      <ul>
        <li>podatke naloga: korisničko ime, email, ime i prezime kada su uneti, uloga i tehničke identifikatore naloga;</li>
        <li>podatke firme ili knjigovodstvene agencije: naziv, PIB, matični broj, adresa, status, delatnost i druge podatke iz javnih registara ili ručnog unosa;</li>
        <li>fiskalne račune i dokumenta koje korisnik skenira, fotografiše ili otpremi, uključujući podatke koji se nalaze na samom dokumentu;</li>
        <li>podatke o povezivanju firme i knjigovođe, verifikacionim pozivima, statusima slanja i korisničkim ovlašćenjima;</li>
        <li>podatke o pretplati, planu, statusu plaćanja i identifikatorima transakcija dobijenim od pružaoca naplate; FiscalBox ne treba da čuva pune podatke platne kartice;</li>
        <li>tehničke podatke potrebne za bezbednost i rad sistema, kao što su IP adresa, vreme zahteva, tip pregledača, zapisi o greškama i bezbednosni logovi;</li>
        <li>podatke za obaveštenja i podršku, uključujući email adresu, push pretplatu i sadržaj zahteva upućenog podršci.</li>
      </ul>

      <h2>3. Svrhe i pravni osnov obrade</h2>
      <p>Podatke obrađujemo radi registracije i vođenja naloga, izvršenja FiscalBox usluge, čuvanja i prosleđivanja dokumenata, povezivanja sa knjigovođom, naplate pretplate, sprečavanja zloupotreba, podrške korisnicima i ispunjavanja zakonskih obaveza. U zavisnosti od konkretne obrade, osnov može biti izvršenje ugovora, zakonska obaveza, legitimni interes za bezbedan i funkcionalan rad servisa ili saglasnost kada je ona potrebna.</p>

      <h2>4. Podaci iz javnih registara</h2>
      <p>FiscalBox može koristiti podatke iz zvaničnih ili javno dostupnih registara radi pronalaženja i potvrde poslovnog subjekta. Ako automatska provera nije dostupna, korisnik može ručno uneti podatke. FiscalBox ne garantuje da je svaki podatak iz eksternog registra trenutno ažuran i zato može prikazati vreme poslednje provere i izvor podatka.</p>

      <h2>5. Fiskalni računi i knjigovodstvena dokumenta</h2>
      <p>Korisnik je odgovoran da u FiscalBox unosi dokumenta za koja ima pravo i poslovni osnov da ih obrađuje. Dokumenta mogu sadržati podatke dobavljača, kupca, zaposlenih ili drugih fizičkih lica. Firma koja koristi FiscalBox ostaje odgovorna za zakonitost sadržaja koji u aplikaciju unosi i deli sa svojim knjigovođom.</p>

      <h2>6. Sa kim se podaci mogu deliti</h2>
      <p>Podaci se mogu obrađivati kod tehničkih dobavljača koji omogućavaju hosting, bazu podataka, skladištenje dokumenata, slanje email i push poruka, naplatu pretplata i druge neophodne funkcije. Podaci se mogu dostaviti državnom organu ili drugom ovlašćenom licu kada za to postoji zakonska obaveza. Pristup knjigovođe podacima klijenta postoji samo kada je veza uspostavljena ili verifikovana u aplikaciji.</p>

      <h2>7. Rokovi čuvanja</h2>
      <p>Podatke naloga i poslovne evidencije čuvamo dok traje korisnički odnos i nakon prestanka onoliko koliko je potrebno radi zakonskih obaveza, rešavanja sporova, bezbednosti i dokazivanja izvršenih radnji. Dokumenta koja korisnik čuva mogu imati posebne rokove čuvanja koje određuju računovodstveni i poreski propisi; korisnik je odgovoran da utvrdi rok koji se na njega primenjuje.</p>

      <h2>8. Bezbednost</h2>
      <p>Primenujemo kontrole pristupa po ulogama, autentikaciju, evidenciju administrativnih radnji, ograničavanje pristupa dokumentima i druge tehničke i organizacione mere. Nijedan sistem nije apsolutno bezbedan, pa korisnik mora da čuva svoje pristupne podatke i odmah prijavi sumnju na zloupotrebu naloga.</p>

      <h2>9. Prava lica na koja se podaci odnose</h2>
      <p>U skladu sa primenljivim propisima, lice može imati pravo na pristup svojim podacima, ispravku, brisanje, ograničenje obrade, prenosivost, prigovor i opoziv saglasnosti kada se obrada zasniva na saglasnosti. Zahtev se može poslati pisanim putem na adresu rukovaoca navedenu u ovoj politici ili putem kanala podrške u aplikaciji. Ako lice smatra da je obrada nezakonita, može se obratiti Povereniku za informacije od javnog značaja i zaštitu podataka o ličnosti.</p>

      <h2>10. Kolačići, lokalno skladište i PWA</h2>
      <p>FiscalBox koristi nužne kolačiće ili slične tehnologije za prijavu, bezbednost, sesiju, podešavanja i funkcionisanje instalirane PWA aplikacije. Marketinške ili analitičke tehnologije koje nisu neophodne ne treba uvoditi bez odgovarajuće pravne osnove i obaveštenja.</p>

      <h2>11. Maloletna lica</h2>
      <p>FiscalBox je poslovna aplikacija i nije namenjena samostalnom korišćenju od strane dece. Nalog treba da otvara punoletno ili drugo ovlašćeno lice poslovnog subjekta.</p>

      <h2>12. Promene politike</h2>
      <p>Politika može biti izmenjena kada se promene funkcije aplikacije, dobavljači, pravni zahtevi ili način obrade. Datum poslednje izmene biće naveden na vrhu dokumenta. Za značajne promene korisnici mogu biti dodatno obavešteni kroz aplikaciju ili email.</p>

      <h2>13. Kontakt</h2>
      <p>Za pitanja u vezi sa privatnošću i obradom podataka možete se obratiti pružaocu usluge: <b>OSKAR ZOMBORI PR ALSET CO.</b>, Sterijina 29, sprat 2, stan 13, 24000 Subotica, Srbija, ili kroz kanal podrške u FiscalBox aplikaciji.</p>

      <LegalLinks/>
    </article>
  </div></main>;
}
