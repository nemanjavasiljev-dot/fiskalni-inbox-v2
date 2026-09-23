import type { Metadata } from "next";
import Link from "next/link";
import BrandWordmark from "@/components/BrandWordmark";
import LegalLinks from "@/components/LegalLinks";

export const metadata: Metadata = {
  title: "Uslovi korišćenja",
  description: "Uslovi korišćenja FiscalBox aplikacije."
};

export default function TermsPage(){
  return <main className="legal-shell"><div className="legal-wrap">
    <div className="legal-head"><Link className="brand" href="/"><span className="logo">F</span><BrandWordmark/></Link><Link className="btn" href="/">Nazad na FiscalBox</Link></div>
    <article className="card legal-card">
      <span className="pill">FISCALBOX</span>
      <h1>Uslovi korišćenja</h1>
      <p className="muted">Poslednje ažuriranje: 23. septembar 2026.</p>

      <div className="legal-meta">
        <div><span>Pružalac FiscalBox usluge</span><b>OSKAR ZOMBORI PR ALSET CO.</b></div>
        <div><span>Vlasnik</span><b>Oskar Zombori</b></div>
        <div><span>PIB</span><b>115266735</b></div>
        <div><span>Matični broj</span><b>68230403</b></div>
        <div><span>Sedište</span><b>Sterijina 29, sprat 2, stan 13, 24000 Subotica, Srbija</b></div>
        <div><span>Delatnost</span><b>Računarsko programiranje i IT usluge</b></div>
      </div>

      <div className="legal-note">Ovi uslovi su produkcioni nacrt za B2B SaaS uslugu. Pre konačne komercijalne objave preporučena je provera od strane pravnika i usklađivanje sa stvarnim načinom naplate, poreskim statusom pružaoca i ugovorima sa eksternim servisima.</div>

      <h2>1. Predmet usluge</h2>
      <p>FiscalBox je digitalna aplikacija za evidentiranje fiskalnih računa i poslovnih dokumenata, skeniranje QR kodova, čuvanje datoteka, pretragu, izvoz, povezivanje firme i knjigovođe i druge funkcije dostupne prema izabranom paketu.</p>

      <h2>2. Prihvatanje uslova</h2>
      <p>Registracijom naloga, aktiviranjem pretplate ili korišćenjem FiscalBox-a korisnik potvrđuje da je ovlašćen da postupa u ime firme ili knjigovodstvene organizacije koju registruje i da prihvata ove uslove i Politiku privatnosti.</p>

      <h2>3. Nalog i pristup</h2>
      <ul>
        <li>Korisnik je odgovoran za tačnost registracionih podataka i čuvanje lozinke.</li>
        <li>Nalog ne sme biti ustupljen neovlašćenom licu.</li>
        <li>Vlasnik ili administrator organizacije određuje zaposlene i druga lica koja imaju pristup podacima organizacije.</li>
        <li>FiscalBox može privremeno ograničiti pristup kada postoji sumnja na kompromitovan nalog, zloupotrebu ili bezbednosni incident.</li>
      </ul>

      <h2>4. Registracija firme i knjigovođe</h2>
      <p>Podaci mogu biti preuzeti iz zvaničnih registara ili uneseni ručno. Automatska verifikacija zavisi od dostupnosti eksternih registara i servisa. Ako automatika nije dostupna, korisnik može nastaviti ručnim unosom. Korisnik je odgovoran da proveri da su podaci njegove organizacije tačni.</p>

      <h2>5. Povezivanje sa knjigovođom</h2>
      <p>Firma može poslati knjigovođi poziv za povezivanje. Povezivanje postaje aktivno nakon odgovarajuće verifikacije ili prihvatanja. Aktivnim povezivanjem knjigovođa dobija pristup podacima klijenta u obimu koji aplikacija i dodeljena uloga dozvoljavaju. Firma ili ovlašćeni administrator može raskinuti vezu kada je takva opcija dostupna.</p>

      <h2>6. Pretplate, cene i probni period</h2>
      <p>Cena, paket, broj korisnika, trajanje probnog perioda i poreski tretman prikazuju se pre aktiviranja naplate. Pretplata se obračunava prema izabranom planu i broju korisnika kada je to deo modela naplate. Korisnik je dužan da obezbedi važeći način plaćanja kod izabranog procesora naplate.</p>
      <p>Ako uplata nije uspešna ili obaveza nije izmirena, FiscalBox može označiti nalog kao neplaćen i suspendovati uslugu do izmirenja obaveze. MASTER administrator može aktivirati ili suspendovati organizaciju u skladu sa evidencijom pretplate i opravdanim administrativnim razlozima.</p>

      <h2>7. Otkazivanje i prestanak</h2>
      <p>Korisnik može otkazati pretplatu putem funkcije koja je dostupna u aplikaciji ili portalu procesora naplate. Otkazivanje proizvodi dejstvo u skladu sa prikazanim obračunskim periodom i pravilima procesora naplate. Pre prestanka korišćenja korisnik treba da izveze podatke koje želi da zadrži.</p>

      <h2>8. Fiskalni računi, QR provera i knjigovodstvo</h2>
      <p>FiscalBox pomaže u digitalnoj obradi i organizaciji dokumenata, ali sam po sebi nije poreski savetnik niti zamena za računovođu. Prikaz statusa provere fiskalnog računa ili poslovnog subjekta zasniva se na podacima koje vrati odgovarajući zvanični ili eksterni servis. Korisnik i njegov knjigovođa ostaju odgovorni za konačnu poresku, računovodstvenu i formalnu proveru dokumenta.</p>

      <h2>9. Dozvoljeno korišćenje</h2>
      <p>Zabranjeno je koristiti FiscalBox za neovlašćen pristup tuđim podacima, masovno preuzimanje podataka iz registara mimo dozvoljenih uslova, širenje zlonamernog koda, lažno predstavljanje, kršenje prava trećih lica ili druge protivpravne radnje. Pružalac može ograničiti ili suspendovati nalog koji ugrožava sistem ili druge korisnike.</p>

      <h2>10. Dostupnost i eksterni servisi</h2>
      <p>FiscalBox zavisi od interneta i određenih eksternih servisa, kao što su hosting, baze podataka, javni registri, email, push notifikacije i procesor naplate. Ne garantuje se neprekidna dostupnost eksternog sistema nad kojim pružalac nema kontrolu. U slučaju privremenog prekida aplikacija može ponuditi ručni unos ili odloženu obradu.</p>

      <h2>11. Čuvanje i izvoz podataka</h2>
      <p>Korisnik treba redovno da proverava dokumenta i koristi dostupne opcije izvoza kada su mu potrebne sopstvene rezervne kopije. Pružalac može primenjivati tehničke limite skladištenja i rokove zadržavanja koji su navedeni u paketu, politici privatnosti ili posebnom obaveštenju.</p>

      <h2>12. Intelektualna svojina</h2>
      <p>FiscalBox aplikacija, njen dizajn, programski kod, naziv, grafički elementi i dokumentacija pripadaju pružaocu ili njihovim zakonitim davaocima licence. Korisnik zadržava prava na sopstvene dokumente i podatke koje unese u servis.</p>

      <h2>13. Ograničenje odgovornosti</h2>
      <p>FiscalBox je alat za organizaciju i razmenu poslovnih podataka. Pružalac ne odgovara za poslovnu odluku donetu isključivo na osnovu automatskog prepoznavanja, podataka iz eksternog registra ili nepotpunog dokumenta, niti za prekid rada eksternog servisa van njegove razumne kontrole. Ova odredba ne isključuje odgovornost koja se po prinudnim propisima ne može isključiti ili ograničiti.</p>

      <h2>14. Izmene funkcija i uslova</h2>
      <p>FiscalBox se kontinuirano razvija i funkcije mogu biti izmenjene, unapređene ili zamenjene. Za značajne izmene ovih uslova korisnik će biti obavešten kroz aplikaciju, email ili objavu ažurirane verzije sa novim datumom.</p>

      <h2>15. Merodavno pravo i rešavanje sporova</h2>
      <p>Na odnos između pružaoca i poslovnog korisnika primenjuje se pravo Republike Srbije. Strane će spor pokušati da reše dogovorom. Ako to nije moguće, nadležnost se određuje prema primenljivim propisima i ugovornom odnosu. Obavezna prava koja korisniku pripadaju po prinudnim propisima ostaju nepromenjena.</p>

      <h2>16. Kontakt</h2>
      <p>Pružalac usluge: <b>OSKAR ZOMBORI PR ALSET CO.</b>, Sterijina 29, sprat 2, stan 13, 24000 Subotica, Srbija. Za operativna pitanja korisnik može koristiti kanal podrške dostupan u FiscalBox aplikaciji.</p>

      <LegalLinks/>
    </article>
  </div></main>;
}
