export async function sendAccountantInvite(opts:{to:string;companyName:string;companyPib?:string;accountantPib:string;verifyUrl:string;expiresAt:string}){
  const expires=new Intl.DateTimeFormat('sr-RS',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Belgrade'}).format(new Date(opts.expiresAt));
  return sendEmail({
    to:opts.to,
    subject:`Novi klijent za verifikaciju · ${opts.companyName} · FiscalBox`,
    html:`<div style="font-family:Arial,sans-serif;line-height:1.55;color:#17221E;max-width:620px;margin:auto"><h2 style="margin-bottom:8px">Novi klijent čeka vašu potvrdu</h2><p>Firma <strong>${escapeHtml(opts.companyName)}</strong>${opts.companyPib?` (PIB ${escapeHtml(opts.companyPib)})`:''} želi da vas poveže kao svog knjigovođu u aplikaciji FiscalBox.</p><p>Zahtev je poslat za knjigovodstvenu firmu PIB <strong>${escapeHtml(opts.accountantPib)}</strong> i na ovu email adresu. Klikom na dugme potvrđujete prijem novog klijenta.</p><p style="margin:24px 0"><a href="${escapeHtml(opts.verifyUrl)}" style="display:inline-block;padding:13px 20px;background:#0D382B;color:#fff;text-decoration:none;border-radius:10px;font-weight:700">Verifikuj i prihvati klijenta</a></p><p>Nakon verifikacije klijent se automatski pojavljuje u vašem FiscalBox dashboardu.</p><p style="font-size:12px;color:#68736e">Link važi do ${escapeHtml(expires)}. Ako niste očekivali ovaj zahtev, nemojte ga potvrditi.</p><p style="font-size:12px;color:#68736e">Ako dugme ne radi, otvorite: ${escapeHtml(opts.verifyUrl)}</p></div>`
  });
}

export async function sendClientInvite(opts:{to:string;accountingOffice:string;companyName:string;inviteUrl:string}){
  return sendEmail({
    to:opts.to,
    subject:`Poziv za FiscalBox · ${opts.companyName}`,
    html:`<p>Knjigovodstvena agencija <strong>${escapeHtml(opts.accountingOffice)}</strong> vas poziva da aktivirate firmu <strong>${escapeHtml(opts.companyName)}</strong> u aplikaciji FiscalBox.</p><p>Kliknite na dugme i postavite svoju lozinku. Podaci firme i veza sa knjigovođom su već pripremljeni.</p><p><a href="${escapeHtml(opts.inviteUrl)}" style="display:inline-block;padding:12px 18px;background:#0D382B;color:#fff;text-decoration:none;border-radius:10px">Aktiviraj FiscalBox</a></p><p style="font-size:12px;color:#68736e">Ako dugme ne radi, otvorite: ${escapeHtml(opts.inviteUrl)}</p>`
  });
}


export async function sendConnectionRequestEmail(opts:{to:string;senderName:string;senderKind:'company'|'accounting';appUrl:string}){
  const senderLabel=opts.senderKind==='accounting'?'Knjigovodstvena agencija':'Firma';
  return sendEmail({
    to:opts.to,
    subject:`Novi zahtev za povezivanje · ${opts.senderName} · FiscalBox`,
    html:`<div style="font-family:Arial,sans-serif;line-height:1.55;color:#17221E;max-width:620px;margin:auto"><h2 style="margin-bottom:8px">Imate novi zahtev u FiscalBox-u</h2><p>${senderLabel} <strong>${escapeHtml(opts.senderName)}</strong> želi povezivanje sa vašim FiscalBox nalogom.</p><p>Radi bezbednosti, povezivanje se <strong>ne prihvata iz emaila</strong>. Prijavite se u FiscalBox i u dashboardu otvorite novi zahtev, pa izaberite <strong>Prihvati</strong> ili <strong>Odbij</strong>.</p><p style="margin:24px 0"><a href="${escapeHtml(opts.appUrl)}" style="display:inline-block;padding:13px 20px;background:#0D382B;color:#fff;text-decoration:none;border-radius:10px;font-weight:700">Otvori FiscalBox dashboard</a></p><p style="font-size:12px;color:#68736e">Ako niste očekivali ovaj zahtev, samo ga odbijte u dashboardu.</p></div>`
  });
}

export async function sendBillingInvoiceEmail(opts:{to:string;organizationName:string;invoiceNumber:string;plan:string;totalAmount:number;billingUrl:string;pdf:Buffer;documentType?:'proforma'|'invoice'}){
  const isInvoice=opts.documentType==='invoice';
  const label=isInvoice?'račun':'predračun';
  const subject=isInvoice?`FiscalBox račun ${opts.invoiceNumber} · ${opts.organizationName}`:`FiscalBox predračun ${opts.invoiceNumber} · ${opts.organizationName}`;
  return sendEmail({
    to:opts.to,
    subject,
    html:`<div style="font-family:Arial,sans-serif;line-height:1.55;color:#17221E;max-width:620px;margin:auto"><h2 style="margin-bottom:8px">FiscalBox ${label}</h2><p>Poštovani,</p><p>za firmu <strong>${escapeHtml(opts.organizationName)}</strong> ${isInvoice?'izdat je finalni račun nakon verifikovane uplate':'kreiran je predračun za izabranu pretplatu'} za paket <strong>${escapeHtml(opts.plan.toUpperCase())}</strong>.</p><p>Ukupan iznos: <strong>${new Intl.NumberFormat('sr-RS',{style:'currency',currency:'RSD'}).format(opts.totalAmount)}</strong>. Izdavalac OSKAR ZOMBORI PR ALSET CO. nije u sistemu PDV-a, pa PDV nije obračunat.</p><p>${isInvoice?'Račun je u PDF prilogu i nalazi se u rubrici <b>Moji računi → Plaćeno</b>.':'Predračun je u PDF prilogu, sadrži NBS IPS QR za plaćanje i nalazi se u rubrici <b>Moji računi → Neplaćeno</b>.'}${opts.billingUrl?` <a href="${escapeHtml(opts.billingUrl)}">Otvori FiscalBox → Moji računi</a>.`:''}</p><p style="font-size:12px;color:#68736e">${isInvoice?'Uplata je verifikovana u FiscalBox sistemu.':'Finalni račun se izdaje nakon evidentiranja i verifikacije uplate.'}</p></div>`,
    attachments:[{filename:`${opts.invoiceNumber}.pdf`,content:opts.pdf.toString('base64')}]
  });
}

async function sendEmail(opts:{to:string;subject:string;html:string;attachments?:Array<{filename:string;content:string}>}){
  const key=process.env.RESEND_API_KEY;
  const from=process.env.APP_EMAIL_FROM;
  if(!key||!from||!opts.to) return {sent:false,configured:false};
  const response=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify({from,to:[opts.to],subject:opts.subject,html:opts.html,attachments:opts.attachments})
  });
  return {sent:response.ok,configured:true,status:response.status};
}

function escapeHtml(value:string){return value.replace(/[&<>'"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]||c));}

export async function sendCustomMasterEmail(opts:{to:string;subject:string;message:string}){
  return sendEmail({
    to:opts.to,
    subject:opts.subject,
    html:`<div style="font-family:Arial,sans-serif;line-height:1.6;color:#17221E"><p>${escapeHtml(opts.message).replace(/\n/g,'<br/>')}</p><p style="font-size:12px;color:#68736e">Poruka poslata iz FiscalBox administracije.</p></div>`
  });
}
