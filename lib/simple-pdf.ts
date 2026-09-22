function ascii(value: unknown) {
  return String(value ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "dj").replace(/Đ/g, "Dj")
    .replace(/[^\x20-\x7E]/g, "?");
}
function esc(value: unknown) { return ascii(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"); }
function fmtMoney(value: unknown) { return `${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RSD`; }
function fmtDate(value: unknown) { const d = value ? new Date(String(value)) : new Date(); return Number.isNaN(d.getTime()) ? "-" : d.toISOString().slice(0, 10); }

export function buildBillingPdf(invoice: any) {
  const issuer = invoice.issuer_snapshot || {};
  const lines: Array<{ text: string; size?: number; bold?: boolean; gap?: number }> = [
    { text: issuer.is_demo ? "DEMO PREDRACUN - nije poreski dokument" : (invoice.document_type === "proforma" ? "PREDRACUN" : "RACUN"), size: 18, bold: true, gap: 28 },
    { text: `Broj: ${invoice.invoice_number}`, size: 11, bold: true },
    { text: `Datum izdavanja: ${fmtDate(invoice.issued_at)}` },
    { text: `Status: ${invoice.status === "paid" ? "PLACENO" : invoice.status === "cancelled" ? "STORNIRANO" : "NEPLACENO"}`, gap: 24 },
    { text: "IZDAVALAC", size: 11, bold: true },
    { text: issuer.company_name || "FiscalBox Demo" },
    { text: `PIB: ${issuer.pib || "000000000"}` },
    { text: issuer.address || "Demo izdavalac", gap: 22 },
    { text: "PRIMALAC", size: 11, bold: true },
    { text: invoice.recipient_name || "-" },
    { text: `PIB: ${invoice.recipient_pib || "-"}` },
    { text: invoice.recipient_address || "-" },
    { text: invoice.recipient_email ? `Email: ${invoice.recipient_email}` : "", gap: 26 },
    { text: "OBRACUN", size: 11, bold: true },
    { text: `${String(invoice.plan || "").toUpperCase()} paket - ${invoice.quantity || 1} korisnik(a)` },
    { text: `Cena bez PDV po korisniku: ${fmtMoney(invoice.unit_price_net)}` },
    { text: `Osnovica: ${fmtMoney(invoice.subtotal_net)}` },
    { text: `PDV ${Number(invoice.vat_rate || 20)}%: ${fmtMoney(invoice.vat_amount)}` },
    { text: `UKUPNO: ${fmtMoney(invoice.total_amount)}`, size: 14, bold: true, gap: 28 },
    { text: issuer.note || "FiscalBox demo izdavalac. Podaci izdavaoca ce biti zamenjeni produkcionim podacima." },
    { text: "FiscalBox - Skeniraj. Sacuvaj. Posalji knjigovodji." }
  ].filter(x => x.text !== "");

  let y = 795;
  const ops: string[] = ["BT"];
  for (const line of lines) {
    const size = line.size || 10;
    ops.push(`/${line.bold ? "F2" : "F1"} ${size} Tf`);
    ops.push(`1 0 0 1 50 ${y} Tm`);
    ops.push(`(${esc(line.text)}) Tj`);
    y -= line.gap || (size + 7);
  }
  ops.push("ET");
  const stream = ops.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"
  ];
  let out = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, i) => { offsets.push(Buffer.byteLength(out, "ascii")); out += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = Buffer.byteLength(out, "ascii");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) out += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, "ascii");
}
