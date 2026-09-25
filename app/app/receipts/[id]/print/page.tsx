import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePib, normalizeVerification, extractBuyerPib, receiptTotalTax } from "@/lib/fiscal";
import { lookupCompanyByPib } from "@/lib/company-registry/company-registry-service";
import PrintButton from "./print-button";
import VatDecisionPanel from "@/components/VatDecisionPanel";
import { ensureVatAiAnalysis } from "@/lib/vat-ai";
import { money, dateTime } from "@/lib/format";

function objectEntriesDeep(raw: unknown): [string, unknown][] {
  const out:[string,unknown][]=[];
  const seen=new Set<unknown>();
  const walk=(v:unknown)=>{
    if(!v||typeof v!=="object"||seen.has(v))return;
    seen.add(v);
    if(Array.isArray(v)){v.forEach(walk);return;}
    for(const [k,val] of Object.entries(v as Record<string,unknown>)){
      out.push([k.toLowerCase(),val]);
      walk(val);
    }
  };
  walk(raw);return out;
}

function findArray(raw:unknown, keys:string[]) {
  const wanted=new Set(keys.map(k=>k.toLowerCase()));
  return objectEntriesDeep(raw).find(([k,v])=>wanted.has(k)&&Array.isArray(v))?.[1] as unknown[]|undefined;
}

function field(obj:any, keys:string[]) {
  if(!obj||typeof obj!=="object")return null;
  const entries=Object.entries(obj);
  for(const key of keys){
    const hit=entries.find(([k,v])=>k.toLowerCase()===key.toLowerCase() && (typeof v==="string"||typeof v==="number"));
    if(hit)return String(hit[1]);
  }
  return null;
}

function displayValue(v:unknown){
  if(v==null||v==="")return "—";
  if(typeof v==="number")return String(v);
  return String(v);
}

export default async function PrintReceipt({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{autoprint?:string}>}){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");

  const {id}=await params;
  const sp=await searchParams;
  const {data:r}=await supabase.from("receipts").select("*").eq("id",id).maybeSingle();
  if(!r)notFound();

  const admin=createAdminClient();
  const {data:org}=await admin.from("organizations")
    .select("id,name,pib,registration_number,address,municipality,company_id,activity_code,activity_name")
    .eq("id",r.organization_id).maybeSingle();

  const normalized=normalizeVerification(r.raw_json || {});
  const buyerPib=normalizePib(normalized.buyer_pib || r.buyer_pib) || extractBuyerPib(r.raw_json || {}) || null;

  // Stari računi mogu imati PIB samo u journal-u (npr. "ID kupca: 10:114814160").
  // Kada ga uspešno prepoznamo, dopunjujemo i sam receipt zapis da ga ubuduće koriste CSV i ostali prikazi.
  if(buyerPib && !normalizePib(r.buyer_pib)){
    await admin.from("receipts").update({buyer_pib:buyerPib}).eq("id",r.id);
  }

  let buyerOrg:any=null;
  if(buyerPib){
    if(normalizePib(org?.pib)===buyerPib){
      buyerOrg=org;
    }else{
      const {data}=await admin.from("organizations")
        .select("id,name,pib,registration_number,address,municipality,company_id")
        .eq("pib",buyerPib).limit(1).maybeSingle();
      buyerOrg=data || null;
    }
  }

  let buyerCompany:any=null;
  if(buyerPib && !buyerOrg){
    const {data}=await admin.from("companies")
      .select("id,name,pib,registration_number,address,city,municipality,activity_code,activity_name,registry_source,registry_checked_at,nbs_last_check,source_status")
      .eq("pib",buyerPib).limit(1).maybeSingle();
    buyerCompany=data || null;
    if(!buyerCompany){
      try{
        const resolved=await lookupCompanyByPib(buyerPib);
        buyerCompany={...resolved.company,registry_source:resolved.source,registry_checked_at:resolved.checkedAt};
      }catch(e:any){
        console.warn("[FiscalBox print] buyer PIB lookup failed",{buyerPib,error:String(e?.message||e).slice(0,180)});
      }
    }
  }

  const buyerName=r.buyer_name || buyerOrg?.name || buyerCompany?.name || null;
  const buyerAddress=r.buyer_address || buyerOrg?.address || buyerCompany?.address || null;
  const buyerCity=r.buyer_city || buyerOrg?.municipality || buyerCompany?.city || buyerCompany?.municipality || null;
  const buyerMb=r.buyer_registration_number || buyerOrg?.registration_number || buyerCompany?.registration_number || null;
  const registrySource=r.buyer_registry_source || buyerCompany?.registry_source || (buyerOrg ? "FiscalBox profil / PIB kupca" : null);
  const registryChecked=buyerCompany?.registry_checked_at || buyerCompany?.nbs_last_check || null;

  if(buyerPib && (buyerName || buyerMb || buyerAddress || buyerCity)){
    const patch:any={buyer_pib:buyerPib};
    if(buyerName)patch.buyer_name=buyerName;
    if(buyerMb)patch.buyer_registration_number=buyerMb;
    if(buyerAddress)patch.buyer_address=buyerAddress;
    if(buyerCity)patch.buyer_city=buyerCity;
    if(registrySource)patch.buyer_registry_source=registrySource;
    await admin.from("receipts").update(patch).eq("id",r.id);
  }

  const {data:accountantMembership}=await admin.from("organization_members")
    .select("role").eq("organization_id",r.organization_id).eq("user_id",user.id).maybeSingle();
  const isAccountantReview=accountantMembership?.role==="accountant";
  let vatAi:any=null;
  if(isAccountantReview){
    vatAi=await ensureVatAiAnalysis(admin,r,org);
  }

  let qrDataUrl="";
  try{
    qrDataUrl=await QRCode.toDataURL(r.qr_url,{errorCorrectionLevel:"M",margin:1,width:360});
  }catch{}

  const raw=r.raw_json || {};
  const items=findArray(raw,["items","invoiceitems","lineitems","lines"]);
  const taxes=findArray(raw,["taxitems","taxes","taxamounts","taxation"]);
  const verified=r.verification_status==="provereno" && normalized.verification_valid!==false;
  const sellerName=normalized.merchant_name || r.merchant_name || "—";
  const sellerPib=normalized.merchant_pib || r.merchant_pib || "—";
  const total=normalized.total_amount ?? r.total_amount;
  const totalTax=receiptTotalTax(r);
  if(r.total_tax==null && totalTax!=null){
    await admin.from("receipts").update({total_tax:totalTax}).eq("id",r.id);
  }
  const payment=normalized.payment_method || r.payment_method || "—";
  const invoiceNo=normalized.invoice_number || r.invoice_number || "—";
  const sdcTime=normalized.sdc_time || r.sdc_time || r.created_at;

  return <main className="receipt-print-page">
    <style>{`
      @page{size:A4;margin:12mm}
      body{background:#eef3f0!important}
      .receipt-print-page{max-width:860px;margin:24px auto;background:#fff;padding:28px 32px;color:#111;font-family:Arial,Helvetica,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.08)}
      .receipt-head{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;border-bottom:3px solid #0D382B;padding-bottom:16px;margin-bottom:18px}.receipt-head h1{font-size:23px;margin:4px 0 0}.receipt-kicker{font-size:11px;font-weight:900;letter-spacing:.08em;color:#0D6B4A}.receipt-doc-label{font-size:11px;color:#54645d;text-align:right;max-width:280px}
      .verify-box{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;border:2px solid ${verified?"#16855d":"#b26a18"};background:${verified?"#effaf4":"#fff8ec"};border-radius:14px;padding:14px 16px;margin:15px 0}.verify-box b{display:block;font-size:14px;color:${verified?"#0D6B4A":"#8a5413"}}.verify-box span{display:block;font-size:11px;margin-top:4px}.verify-stamp{font-size:11px;font-weight:900;border:1px solid currentColor;border-radius:99px;padding:7px 10px;white-space:nowrap;color:${verified?"#0D6B4A":"#8a5413"}}
      .section{margin-top:20px}.section h2{font-size:14px;margin:0 0 9px;color:#0D382B;border-bottom:1px solid #dfe7e3;padding-bottom:7px}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px 18px}.kv{display:grid;grid-template-columns:150px 1fr;border-bottom:1px dotted #d7dfdb;padding:5px 0;gap:10px;font-size:12px}.kv span:first-child{color:#58665f}.kv b{font-weight:750}.party{border:1px solid #dfe7e3;border-radius:12px;padding:13px 14px}.party-title{font-size:10px;letter-spacing:.08em;font-weight:900;color:#64736c;margin-bottom:7px}.party-name{font-size:15px;font-weight:900;margin-bottom:5px}.registry-note{font-size:10px;color:#0D6B4A;margin-top:7px;font-weight:800}
      table.fiscal{width:100%;border-collapse:collapse;font-size:11px}.fiscal th,.fiscal td{border-bottom:1px solid #e1e6e3;padding:7px 6px;text-align:left;vertical-align:top}.fiscal th{background:#f4f7f5;font-weight:850}.num{text-align:right!important}.totals{margin-left:auto;width:min(360px,100%);margin-top:12px}.totals .kv{grid-template-columns:1fr auto}.grand{font-size:15px;border-top:2px solid #111;border-bottom:2px solid #111;padding:9px 0!important}
      .journal{white-space:pre-wrap;font-family:"Courier New",monospace;font-size:10px;line-height:1.35;border:1px solid #d8dedb;background:#fbfcfb;padding:14px;border-radius:8px;overflow-wrap:anywhere}.qr-area{display:grid;grid-template-columns:48mm 1fr;gap:18px;align-items:center;margin-top:18px;border-top:2px solid #0D382B;padding-top:15px}.qr-area img{width:46mm;height:46mm;image-rendering:auto}.qr-link{font-size:10px;word-break:break-all}.qr-link b{font-size:12px;display:block;margin-bottom:5px}.footer-note{margin-top:16px;font-size:9px;line-height:1.5;color:#5d6863;border-top:1px solid #dfe5e2;padding-top:10px}.no-print{margin-bottom:15px}
      @media(max-width:700px){.receipt-print-page{margin:0;padding:18px}.grid2{grid-template-columns:1fr}.receipt-head{flex-direction:column}.receipt-doc-label{text-align:left}.qr-area{grid-template-columns:1fr}.kv{grid-template-columns:120px 1fr}}
      @media print{body{background:#fff!important}.receipt-print-page{box-shadow:none;margin:0;max-width:none;padding:0}.no-print{display:none!important}.section{break-inside:avoid}.qr-area{break-inside:avoid}.journal{break-inside:auto}.verify-box{break-inside:avoid}}
    `}</style>

    <div className="no-print"><PrintButton autoPrint={sp.autoprint==="1"}/></div>

    <header className="receipt-head">
      <div><div className="receipt-kicker">FISCALBOX · KNJIGOVODSTVENI ARHIV</div><h1>Fiskalni račun – verifikacioni prikaz</h1></div>
      <div className="receipt-doc-label">Podaci su preuzeti sa fiskalnog računa i sistema verifikacije eFiskalizacije.</div>
    </header>

    <div className="verify-box">
      <div>
        <b>{verified ? "✓ FISKALNI RAČUN VERIFIKOVAN U SISTEMU PORESKE UPRAVE" : "⚠ VERIFIKACIJA FISKALNOG RAČUNA NIJE POTVRĐENA"}</b>
        <span>Status Poreske uprave: {normalized.verification_status_text || r.verification_status || "Nije dostupan"}</span>
        <span>Sačuvano u FiscalBox-u: {dateTime(r.created_at)}</span>
      </div>
      <div className="verify-stamp">{verified?"VERIFIKOVAN":"PROVERITI"}</div>
    </div>

    {isAccountantReview && vatAi ? <VatDecisionPanel
      receiptId={String(r.id)}
      recommendation={vatAi.recommendation}
      confidence={Number(vatAi.confidence||0)}
      reason={String(vatAi.reason||"")}
      initialDecision={typeof r.vat_deductible==="boolean"?r.vat_deductible:null}
    /> : null}

    <section className="section grid2">
      <div className="party">
        <div className="party-title">IZDAVALAC / DOBAVLJAČ</div>
        <div className="party-name">{sellerName}</div>
        <div className="kv"><span>PIB</span><b>{sellerPib}</b></div>
        <div className="kv"><span>Prodajno mesto</span><b>{normalized.location_name || "—"}</b></div>
        <div className="kv"><span>Adresa</span><b>{normalized.address || "—"}</b></div>
        <div className="kv"><span>Mesto</span><b>{[normalized.city,normalized.municipality].filter(Boolean).join(" / ") || "—"}</b></div>
      </div>
      <div className="party">
        <div className="party-title">KUPAC / FIRMA NA KOJU GLASI RAČUN</div>
        <div className="party-name">{buyerName || (buyerPib ? "Naziv kupca nije dostupan u registru" : "Račun nema evidentiran PIB pravnog lica kupca")}</div>
        <div className="kv"><span>PIB kupca</span><b>{buyerPib || "—"}</b></div>
        <div className="kv"><span>Matični broj</span><b>{buyerMb || "—"}</b></div>
        <div className="kv"><span>Adresa</span><b>{buyerAddress || "—"}</b></div>
        <div className="kv"><span>Mesto</span><b>{buyerCity || "—"}</b></div>
        {registrySource && <div className="registry-note">✓ Firma proverena u registru: {registrySource}{registryChecked?` · ${dateTime(registryChecked)}`:""}</div>}
      </div>
    </section>

    <section className="section">
      <h2>Fiskalni podaci</h2>
      <div className="grid2">
        <div>
          <div className="kv"><span>SDC broj računa</span><b>{invoiceNo}</b></div>
          <div className="kv"><span>SDC datum i vreme</span><b>{dateTime(sdcTime)}</b></div>
          <div className="kv"><span>Brojač računa</span><b>{normalized.invoice_counter || "—"}</b></div>
          <div className="kv"><span>Tip računa / transakcije</span><b>{normalized.invoice_type_extension || "—"}</b></div>
        </div>
        <div>
          <div className="kv"><span>Requested by</span><b>{normalized.requested_by || "—"}</b></div>
          <div className="kv"><span>Signed by</span><b>{normalized.signed_by || "—"}</b></div>
          <div className="kv"><span>POS / MRC</span><b>{normalized.pos_number || "—"}</b></div>
          <div className="kv"><span>Referentni dokument</span><b>{normalized.reference_number || "—"}</b></div>
        </div>
      </div>
    </section>

    {items?.length ? <section className="section">
      <h2>Stavke računa</h2>
      <table className="fiscal"><thead><tr><th>Naziv</th><th className="num">Količina</th><th className="num">Cena</th><th className="num">Iznos</th><th>PDV oznaka</th></tr></thead><tbody>
        {items.map((it:any,i)=><tr key={i}><td>{field(it,["name","itemname","productname","description"])||`Stavka ${i+1}`}</td><td className="num">{displayValue(field(it,["quantity","qty"]))}</td><td className="num">{displayValue(field(it,["unitprice","price"]))}</td><td className="num">{displayValue(field(it,["totalamount","total","amount"]))}</td><td>{displayValue(field(it,["labels","label","taxlabel"]))}</td></tr>)}
      </tbody></table>
    </section>:null}

    {taxes?.length ? <section className="section">
      <h2>Specifikacija poreza</h2>
      <table className="fiscal"><thead><tr><th>Oznaka</th><th>Naziv</th><th className="num">Stopa</th><th className="num">Porez</th></tr></thead><tbody>
        {taxes.map((it:any,i)=><tr key={i}><td>{displayValue(field(it,["label","taxlabel"]))}</td><td>{displayValue(field(it,["name","taxname"]))}</td><td className="num">{displayValue(field(it,["rate","taxrate"]))}</td><td className="num">{displayValue(field(it,["taxamount","amount","value"]))}</td></tr>)}
      </tbody></table>
    </section>:null}

    <section className="section">
      <h2>Iznosi i plaćanje</h2>
      <div className="totals">
        <div className="kv"><span>Način plaćanja</span><b>{payment}</b></div>
        <div className="kv"><span>Ukupan PDV</span><b>{money(totalTax)}</b></div>
        <div className="kv grand"><span>UKUPAN IZNOS</span><b>{money(total)}</b></div>
      </div>
    </section>

    {normalized.journal ? <section className="section">
      <h2>Originalni fiskalni zapis (journal)</h2>
      <div className="journal">{normalized.journal}</div>
    </section>:null}

    <section className="qr-area">
      <div>{qrDataUrl ? <img src={qrDataUrl} alt="QR kod za verifikaciju fiskalnog računa"/> : null}</div>
      <div className="qr-link"><b>QR / link za proveru autentičnosti</b><a href={r.qr_url}>{r.qr_url}</a><p>Skeniranjem QR koda otvara se zvanična provera fiskalnog računa.</p></div>
    </section>

    <div className="footer-note">
      FiscalBox ne izdaje fiskalni račun, već čuva i prikazuje podatke preuzete sa verifikacionog linka. Fiskalni račun verifikuje Poreska uprava kroz sistem eFiskalizacije. NBS/APR podatak, kada je prikazan uz kupca, odnosi se na proveru pravnog subjekta, ne na verifikaciju samog fiskalnog računa. Za konačnu proveru autentičnosti koristite QR kod ili verifikacioni link iznad.
    </div>
  </main>
}
