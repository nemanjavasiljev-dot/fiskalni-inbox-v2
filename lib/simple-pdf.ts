import { receiptTotalTax } from "@/lib/fiscal";
import { buildIpsPaymentString, qrMatrixFromText } from '@/lib/ips-payment';

function ascii(value: unknown) {
  return String(value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'dj').replace(/Đ/g, 'Dj')
    .replace(/[čć]/g, 'c').replace(/[ČĆ]/g, 'C')
    .replace(/š/g, 's').replace(/Š/g, 'S')
    .replace(/ž/g, 'z').replace(/Ž/g, 'Z')
    .replace(/[^\x20-\x7E]/g, '?');
}
function esc(value: unknown) { return ascii(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }
function fmtMoney(value: unknown, currency = 'RSD') { const n=Number(value||0); const parts=n.toFixed(2).split('.'); const ints=parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,'.'); return `${ints},${parts[1]} ${currency}`; }
function fmtDate(value: unknown) { const d = value ? new Date(String(value)) : new Date(); return Number.isNaN(d.getTime()) ? '-' : new Intl.DateTimeFormat('sr-RS').format(d); }
function safe(v: unknown, max = 80) { const s = ascii(v).trim(); return s.length > max ? `${s.slice(0, max - 3)}...` : s; }
function statusText(status: string) {
  return ({ paid: 'PLACENO', unpaid: 'NEPLACENO', converted: 'REALIZOVAN', cancelled: 'STORNIRANO', refunded: 'REFUNDIRANO', partial_refund: 'DELIMICNO REFUNDIRANO' } as any)[status] || String(status || '').toUpperCase();
}

function text(x: number, y: number, value: unknown, size = 10, bold = false, color = '0.08 0.12 0.10') {
  return `BT\n${color} rg\n/${bold ? 'F2' : 'F1'} ${size} Tf\n1 0 0 1 ${x} ${y} Tm\n(${esc(value)}) Tj\nET`;
}
function rect(x:number,y:number,w:number,h:number,fill:string,stroke?:string){
  const parts=[`${fill} rg`,`${x} ${y} ${w} ${h} re`,`f`];
  if(stroke)parts.push(`${stroke} RG`,`${x} ${y} ${w} ${h} re`,`S`);
  return parts.join('\n');
}
function line(x1:number,y1:number,x2:number,y2:number,color='0.82 0.85 0.83',width=1){return `${color} RG\n${width} w\n${x1} ${y1} m\n${x2} ${y2} l\nS`;}

function qrOps(qrText:string,x:number,y:number,size:number){
  const matrix=qrMatrixFromText(qrText);const quiet=4;const total=matrix.size+quiet*2;const cell=size/total;const ops:string[]=[rect(x,y,size,size,'1 1 1','0.82 0.85 0.83')];
  ops.push('0 0 0 rg');
  for(let r=0;r<matrix.size;r++)for(let c=0;c<matrix.size;c++)if(matrix.isDark(r,c)){
    const px=x+(c+quiet)*cell;const py=y+(matrix.size-1-r+quiet)*cell;ops.push(`${px.toFixed(3)} ${py.toFixed(3)} ${(cell+0.05).toFixed(3)} ${(cell+0.05).toFixed(3)} re f`);
  }
  return ops.join('\n');
}

function finishPdf(stream:string){
  const objects=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream,'ascii')} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'
  ];
  let out='%PDF-1.4\n';const offsets=[0];
  objects.forEach((obj,i)=>{offsets.push(Buffer.byteLength(out,'ascii'));out+=`${i+1} 0 obj\n${obj}\nendobj\n`;});
  const xref=Buffer.byteLength(out,'ascii');out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<=objects.length;i++)out+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;
  out+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out,'ascii');
}

export function buildBillingPdf(invoice:any){
  const issuer=invoice.issuer_snapshot||{};
  if(!issuer.company_name||issuer.is_demo===true)throw new Error('Produkcioni podaci izdavaoca nisu podešeni za ovaj dokument.');
  const currency=String(invoice.currency||'RSD').toUpperCase();
  const isProforma=invoice.document_type==='proforma';
  const isPaid=invoice.status==='paid';
  const title=isProforma?'PREDRACUN':'RACUN';
  const ops:string[]=[];

  // header / logo
  ops.push(rect(42,758,52,52,'0.05 0.22 0.17'));
  ops.push(text(59,773,'F',26,true,'1 1 1'));
  ops.push(text(108,790,'FiscalBox',22,true,'0.05 0.22 0.17'));
  ops.push(text(108,772,'Skeniraj. Sacuvaj. Posalji knjigovodji.',8,false,'0.38 0.43 0.41'));
  ops.push(text(410,790,title,19,true,'0.05 0.22 0.17'));
  ops.push(text(410,772,`Broj: ${invoice.invoice_number}`,9,true));
  ops.push(line(42,744,553,744,'0.05 0.22 0.17',1.4));

  // issuer and recipient
  ops.push(text(42,724,'IZDAVALAC',9,true,'0.05 0.22 0.17'));
  ops.push(text(42,707,safe(issuer.company_name,58),11,true));
  ops.push(text(42,691,`PIB: ${issuer.pib||'-'}   MB: ${issuer.registration_number||'-'}`,9));
  ops.push(text(42,676,safe(issuer.address||'-',72),8));
  ops.push(text(42,661,issuer.not_in_vat?'Status PDV: NIJE U SISTEMU PDV-a':'Status PDV: PDV obveznik',8,true,'0.55 0.22 0.08'));

  ops.push(text(315,724,'PRIMALAC',9,true,'0.05 0.22 0.17'));
  ops.push(text(315,707,safe(invoice.recipient_name||'-',44),11,true));
  ops.push(text(315,691,`PIB: ${invoice.recipient_pib||'-'}   MB: ${invoice.recipient_registration_number||'-'}`,9));
  ops.push(text(315,676,safe(invoice.recipient_address||'-',44),8));
  if(invoice.recipient_email)ops.push(text(315,661,safe(invoice.recipient_email,44),8));
  ops.push(line(42,645,553,645));

  // document metadata
  ops.push(text(42,626,`Datum izdavanja: ${fmtDate(invoice.issued_at)}`,9));
  ops.push(text(235,626,`Rok placanja: ${invoice.due_at?fmtDate(invoice.due_at):'-'}`,9));
  ops.push(text(430,626,`Status: ${statusText(invoice.status)}`,9,true,isPaid?'0.10 0.48 0.24':'0.70 0.18 0.15'));
  if(invoice.source_proforma_id)ops.push(text(42,610,`Osnov: realizovan predracun / uplata verifikovana ${invoice.verified_at?fmtDate(invoice.verified_at):''}`,8));
  if(invoice.service_period_start&&invoice.service_period_end)ops.push(text(315,610,`Period usluge: ${fmtDate(invoice.service_period_start)} - ${fmtDate(invoice.service_period_end)}`,8));

  // item table
  const top=580;ops.push(rect(42,top,511,26,'0.93 0.95 0.94'));
  ops.push(text(52,top+8,'Opis',9,true));ops.push(text(355,top+8,'Kol.',9,true));ops.push(text(405,top+8,'Cena',9,true));ops.push(text(492,top+8,'Ukupno',9,true));
  ops.push(line(42,top,553,top));
  const desc=`FiscalBox ${String(invoice.plan||'basic').toUpperCase()} - mesecna pretplata`;
  ops.push(text(52,top-24,desc,9));ops.push(text(365,top-24,String(invoice.quantity||1),9));ops.push(text(405,top-24,fmtMoney(invoice.unit_price_net,currency),9));ops.push(text(492,top-24,fmtMoney(invoice.subtotal_net,currency),9,true));
  ops.push(line(42,top-40,553,top-40));

  const sY=490;
  ops.push(text(350,sY+42,'Osnovica:',9));ops.push(text(475,sY+42,fmtMoney(invoice.subtotal_net,currency),9,true));
  ops.push(text(350,sY+25,`PDV ${Number(invoice.vat_rate||0)}%:`,9));ops.push(text(475,sY+25,fmtMoney(invoice.vat_amount,currency),9,true));
  ops.push(line(345,sY+12,553,sY+12));
  ops.push(text(350,sY-8,'UKUPNO ZA UPLATU:',11,true,'0.05 0.22 0.17'));ops.push(text(475,sY-8,fmtMoney(invoice.total_amount,currency),11,true,'0.05 0.22 0.17'));

  // VAT/legal note
  const legalNote=issuer.not_in_vat||Number(invoice.vat_rate||0)===0
    ? 'PDV nije obracunat - izdavalac nije u sistemu PDV-a (clan 33 Zakona o PDV).'
    : issuer.note||'';
  ops.push(rect(42,420,511,42,'0.98 0.95 0.88'));
  ops.push(text(52,444,'PORESKA NAPOMENA',8,true,'0.55 0.22 0.08'));
  ops.push(text(52,428,safe(legalNote,95),8,false,'0.28 0.25 0.18'));

  // payment instructions and IPS QR on unpaid proforma only
  if(isProforma&&!isPaid){
    const bank=String(issuer.bank_account||'').trim();
    if(!bank)throw new Error('Broj bankovnog racuna izdavaoca nije podesen. Unesite ga u MASTER > Racuni / predracuni.');
    const reference=String(invoice.payment_reference||'').trim();
    const ips=buildIpsPaymentString({bankAccount:bank,payeeName:issuer.company_name,amount:Number(invoice.total_amount||0),paymentCode:issuer.payment_code||'221',purpose:`FiscalBox ${invoice.invoice_number}`,paymentReference:reference});
    ops.push(text(42,392,'INSTRUKCIJE ZA UPLATU',9,true,'0.05 0.22 0.17'));
    ops.push(text(42,374,`Racun primaoca: ${bank}`,9,true));
    ops.push(text(42,357,`Poziv na broj: ${reference||'-'}`,9));
    ops.push(text(42,340,`Sifra placanja: ${issuer.payment_code||'221'}   Svrha: FiscalBox ${invoice.invoice_number}`,9));
    ops.push(text(42,323,'Placanje je moguce skeniranjem NBS IPS QR koda u m-banking aplikaciji.',8));
    ops.push(qrOps(ips,405,250,132));
    ops.push(text(432,236,'NBS IPS QR',8,true,'0.05 0.22 0.17'));
    ops.push(rect(42,250,335,55,'0.94 0.97 0.96'));
    ops.push(text(52,286,'VAZNO',8,true,'0.05 0.22 0.17'));
    ops.push(text(52,270,'Predracun nije dokaz o placanju. Finalni racun se izdaje nakon',8));
    ops.push(text(52,257,'evidentiranja i verifikacije uplate u FiscalBox sistemu.',8));
  } else {
    ops.push(rect(42,315,511,70,'0.93 0.98 0.95'));
    ops.push(text(52,365,'UPLATA VERIFIKOVANA',10,true,'0.10 0.48 0.24'));
    ops.push(text(52,347,`Datum uplate: ${fmtDate(invoice.paid_at||invoice.verified_at)}`,9));
    ops.push(text(52,330,`Nacin verifikacije: ${safe(invoice.verification_source||'FiscalBox / banka',55)}`,9));
    if(invoice.payment_reference)ops.push(text(300,347,`Poziv na broj: ${invoice.payment_reference}`,9));
  }

  ops.push(line(42,208,553,208));
  ops.push(text(42,190,`OSKAR ZOMBORI PR ALSET CO. | PIB 115266735 | MB 68230403`,8,true));
  ops.push(text(42,175,'Sterijina 29, sprat 2, stan 13, 24000 Subotica, Srbija',8));
  ops.push(text(42,158,`Dokument generisan kroz FiscalBox. ID: ${String(invoice.id||'').slice(0,18)}`,7,false,'0.45 0.48 0.46'));

  return finishPdf(ops.join('\n'));
}

export function buildReceiptArchivePdf(receipt:any,organization?:any){
  const ops:string[]=[];
  ops.push(rect(42,758,52,52,'0.05 0.22 0.17'));ops.push(text(59,773,'F',26,true,'1 1 1'));ops.push(text(108,790,'FiscalBox',22,true,'0.05 0.22 0.17'));
  ops.push(text(390,790,'FISKALNI RACUN',16,true,'0.05 0.22 0.17'));ops.push(line(42,744,553,744,'0.05 0.22 0.17',1.4));
  let y=720;
  const rows:[string,unknown][]=[
    ['Klijent',organization?.name||'-'],['PIB klijenta',organization?.pib||'-'],['Dobavljac',receipt.merchant_name||'-'],['PIB dobavljaca',receipt.merchant_pib||'-'],['Broj racuna',receipt.invoice_number||'-'],['SDC broj',receipt.sdc_number||receipt.sdc_id||'-'],['Datum i vreme',fmtDate(receipt.sdc_time||receipt.created_at)],['Iznos',fmtMoney(receipt.total_amount,'RSD')],['PDV',fmtMoney(receiptTotalTax(receipt),'RSD')],['Nacin placanja',receipt.payment_method||'-'],['Kategorija',receipt.category||'Ostalo'],['Status verifikacije',receipt.verification_status||'-'],['Odbitni PDV',receipt.vat_deductible===true?'DA':receipt.vat_deductible===false?'NE':'CEKA ODLUKU'],['AI predlog PDV',receipt.ai_vat_recommendation?String(receipt.ai_vat_recommendation).toUpperCase():'-']
  ];
  for(const [label,value] of rows){ops.push(text(42,y,label,8,true,'0.38 0.43 0.41'));ops.push(text(175,y,safe(value,65),10));y-=25;}
  ops.push(line(42,y+8,553,y+8));y-=12;
  ops.push(text(42,y,'Napomena',8,true,'0.38 0.43 0.41'));y-=18;ops.push(text(42,y,safe(receipt.note||'Kopija podataka fiskalnog racuna iz FiscalBox arhive.',90),8));
  y-=35;ops.push(text(42,y,'Ovaj PDF je arhivska kopija zapisa. Originalni fiskalni racun i status',8));y-=14;ops.push(text(42,y,'provere cuvaju se u FiscalBox-u i u sistemu eFiskalizacije kada su dostupni.',8));
  return finishPdf(ops.join('\n'));
}
