"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Calculator, Check, CreditCard } from "lucide-react";
import { type CompanySearchValue } from "@/components/CompanySearch";
import CompanyLookup from "@/components/CompanyLookup";

type Role = "company" | "accountant";
type Plan = "basic" | "premium";

function latinUsernameBase(value: string) {
  const map: Record<string,string> = {
    а:"a",б:"b",в:"v",г:"g",д:"d",ђ:"dj",е:"e",ж:"z",з:"z",и:"i",ј:"j",к:"k",л:"l",љ:"lj",м:"m",н:"n",њ:"nj",о:"o",п:"p",р:"r",с:"s",т:"t",ћ:"c",у:"u",ф:"f",х:"h",ц:"c",ч:"c",џ:"dz",ш:"s"
  };
  const latin=value.toLowerCase().split("").map(ch=>map[ch]??ch).join("");
  return latin.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,".").replace(/^\.+|\.+$/g,"").slice(0,26) || "firma";
}

export default function RegisterForm({initialPlan="basic",initialTrial=true}:{initialPlan?:string;initialTrial?:boolean}) {
  const router=useRouter();
  const [step,setStep]=useState(1);
  const [role,setRole]=useState<Role>("company");
  const [company,setCompany]=useState<CompanySearchValue|null>(null);
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [plan,setPlan]=useState<Plan>(initialPlan==="premium"?"premium":"basic");
  const [trial,setTrial]=useState(Boolean(initialTrial));
  const [accountantInviteChannel,setAccountantInviteChannel]=useState<"email"|"sms">("email");
  const [accountantInviteContact,setAccountantInviteContact]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const usernamePreview=useMemo(()=>company?latinUsernameBase(company.name):"",[company]);

  function next(){setError("");setStep(s=>Math.min(5,s+1));}
  function back(){setError("");setStep(s=>Math.max(1,s-1));}
  function validateAccount(){
    if(!/^\S+@\S+\.\S+$/.test(email.trim())){setError("Unesite ispravnu email adresu.");return false;}
    if(password.length<8){setError("Lozinka mora imati najmanje 8 znakova.");return false;}
    setError("");return true;
  }

  async function startCheckout(orgId:string,selectedPlan:Plan){
    const r=await fetch("/api/subscriptions/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({organization_id:orgId,plan:selectedPlan})});
    const d=await r.json();if(!r.ok)throw new Error(d.error||"Online pretplata nije mogla da se pokrene.");window.location.href=d.url;
  }

  async function submit(){
    if(!company){setError("Pronađite i izaberite firmu.");return;}
    if(!validateAccount())return;
    setBusy(true);setError("");
    try{
      const r=await fetch("/api/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({role,email:email.trim().toLowerCase(),password,company_id:company.id,plan,trial,company_contact_email:company.contact_email||"",company_contact_phone:company.contact_phone||"",accountant_invite_channel:role==="company"?accountantInviteChannel:"email",accountant_invite_contact:role==="company"?accountantInviteContact:""})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Registracija nije uspela.");
      if(d.accountant_invite_error){window.alert(`Nalog je kreiran, ali poziv knjigovođi nije poslat: ${d.accountant_invite_error}. Poziv možete ponovo poslati iz menija Više.`);}
      if(d.checkout_required&&d.organization_id){await startCheckout(d.organization_id,plan);return;}
      router.push(d.redirect||"/app");router.refresh();
    }catch(e:any){setError(e.message||"Registracija nije uspela.");}
    finally{setBusy(false);}
  }

  return <div className="register-flow">
    <div className="register-progress">{[1,2,3,4,5].map(n=><span key={n} className={n<=step?"active":""}>{n}</span>)}</div>

    {step===1&&<section className="register-step">
      <h2>Ko otvara nalog?</h2><p className="muted">Izaberite tip naloga.</p>
      <div className="role-choice">
        <button className={`role-choice-card ${role==="company"?"selected":""}`} onClick={()=>setRole("company")}><Building2/><b>FIRMA</b><span>Fiskalni računi, dokumenti i knjigovođa.</span>{role==="company"&&<Check className="choice-check"/>}</button>
        <button className={`role-choice-card ${role==="accountant"?"selected":""}`} onClick={()=>setRole("accountant")}><Calculator/><b>KNJIGOVOĐA</b><span>Klijenti, dokumentacija, PDV i zaposleni.</span>{role==="accountant"&&<Check className="choice-check"/>}</button>
      </div>
      <button className="btn btn-primary register-next" onClick={next}>Nastavi</button>
    </section>}

    {step===2&&<section className="register-step">
      <h2>Pronađite firmu</h2>
      <p className="muted">Unesite PIB. Kada unesete svih 9 cifara, FiscalBox automatski proverava zvanične registre i povezuje rezultat sa lokalnom APR bazom. Ako PIB provera nije dostupna, možete nastaviti po nazivu ili matičnom broju.</p>
      <CompanyLookup value={company} onSelect={setCompany} label={role==="accountant"?"PIB knjigovodstvene firme":"PIB"} required showDetails/>
      {company&&<div className="company-confirm"><Check size={17}/><div><b>Ovo je moja firma</b><span>Korisničko ime će biti generisano automatski iz naziva firme.</span>{usernamePreview&&<small>Primer: <strong>{usernamePreview}</strong></small>}</div></div>}
      {error&&<div className="error">{error}</div>}
      <div className="register-actions"><button className="btn" onClick={back}>Nazad</button><button className="btn btn-primary" disabled={!company} onClick={next}>Ovo je moja firma</button></div>
    </section>}

    {step===3&&<section className="register-step">
      <h2>Pristup nalogu</h2>
      <p className="muted">Ime i prezime se ne traže u osnovnoj registraciji. Možete ih dodati kasnije u podešavanjima.</p>
      <div className="setup-grid">
        <div className="field setup-wide"><label>Email</label><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></div>
        <div className="field setup-wide"><label>Lozinka</label><input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/></div>
      </div>
      {usernamePreview&&<div className="lookup-message">Korisničko ime će sistem automatski napraviti na osnovu naziva firme: <b>{usernamePreview}</b>. Ako je zauzeto, dodaće broj.</div>}
      {error&&<div className="error">{error}</div>}
      <div className="register-actions"><button className="btn" onClick={back}>Nazad</button><button className="btn btn-primary" onClick={()=>validateAccount()&&next()}>Nastavi</button></div>
    </section>}

    {step===4&&<section className="register-step">
      <h2>Izaberite paket i način početka</h2>
      <div className="register-plans register-plans-production">
        <button className={`register-plan ${plan==="basic"?"selected":""}`} onClick={()=>setPlan("basic")}><b>Basic</b><strong>1.250 RSD + PDV</strong><small>po korisniku / mesečno</small><span>QR, fajlovi, arhiva, knjigovođa</span></button>
        <button className={`register-plan ${plan==="premium"?"selected":""}`} onClick={()=>setPlan("premium")}><span className="tag-inline">PREPORUČENO</span><b>Premium</b><strong>1.790 RSD + PDV</strong><small>po korisniku / mesečno</small><span>Napredni pregledi, PDF paketi i prioritetne funkcije</span></button>
      </div>
      <div className="trial-choice-grid">
        <button className={`trial-choice ${trial?"selected":""}`} onClick={()=>setTrial(true)}><span className="trial-icon">10</span><div><b>Probaj 10 dana besplatno</b><small>Bez kartice. Sve funkcije iz izabranog paketa.</small></div>{trial&&<Check/>}</button>
        <button className={`trial-choice ${!trial?"selected":""}`} onClick={()=>setTrial(false)}><CreditCard/><div><b>Aktiviraj pretplatu odmah</b><small>Posle registracije otvara se sigurno online plaćanje.</small></div>{!trial&&<Check/>}</button>
      </div>
      <div className="register-actions"><button className="btn" onClick={back}>Nazad</button><button className="btn btn-primary" onClick={()=>role==="company"?next():submit()} disabled={busy}>{role==="company"?"Nastavi":busy?"Kreiram nalog…":trial?"Pokreni 10 dana besplatno":"Registruj i pređi na plaćanje"}</button></div>
    </section>}

    {step===5&&role==="company"&&<section className="register-step">
      <h2>Povežite knjigovođu <span className="optional-label">opciono</span></h2>
      <p className="muted">Najjednostavnije povezivanje: izaberite email ili SMS i unesite samo taj kontakt. Knjigovođa dobija obaveštenje, a zahtev prihvata iz svog FiscalBox dashboarda.</p>
      <div className="invite-channel-switch"><button type="button" className={accountantInviteChannel==="email"?"active":""} onClick={()=>{setAccountantInviteChannel("email");setAccountantInviteContact("")}}>Email</button><button type="button" className={accountantInviteChannel==="sms"?"active":""} onClick={()=>{setAccountantInviteChannel("sms");setAccountantInviteContact("")}}>SMS</button></div>
      <div className="field setup-wide"><label>{accountantInviteChannel==="email"?"Email knjigovođe":"Telefon knjigovođe"}</label><input className="input" type={accountantInviteChannel==="email"?"email":"tel"} value={accountantInviteContact} onChange={e=>setAccountantInviteContact(e.target.value)} placeholder={accountantInviteChannel==="email"?"knjigovodja@firma.rs":"+381601234567"}/></div>
      {error&&<div className="error">{error}</div>}
      <div className="register-actions"><button className="btn" onClick={back}>Nazad</button><button className="btn" onClick={()=>{setAccountantInviteContact("");submit()}} disabled={busy}>Preskoči za sada</button><button className="btn btn-primary" onClick={submit} disabled={busy||(accountantInviteContact!==""&&(accountantInviteChannel==="email"?!/^\S+@\S+\.\S+$/.test(accountantInviteContact.trim()):accountantInviteContact.replace(/\D/g,"").length<8))}>{busy?"Kreiram nalog…":trial?"Pokreni 10 dana besplatno":"Registruj i pređi na plaćanje"}</button></div>
    </section>}
  </div>;
}
