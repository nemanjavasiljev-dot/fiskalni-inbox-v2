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


export async function sendRegistrationVerificationEmail(opts:{to:string;username:string;verifyUrl:string;magic?:boolean}){
  const title=opts.magic?'Potvrdite email i otvorite FiscalBox':'Potvrdite FiscalBox nalog';
  return sendEmail({
    to:opts.to,
    subject:`${title} · FiscalBox`,
    html:`<div style="font-family:Arial,sans-serif;line-height:1.55;color:#17221E;max-width:620px;margin:auto"><h2 style="margin-bottom:8px">${title}</h2><p>Poštovani,</p><p>FiscalBox nalog <strong>${escapeHtml(opts.username)}</strong> je kreiran za ovu email adresu.</p><p>Da biste aktivirali nalog i potvrdili email, kliknite na dugme:</p><p style="margin:24px 0"><a href="${escapeHtml(opts.verifyUrl)}" style="display:inline-block;padding:13px 20px;background:#0D382B;color:#fff;text-decoration:none;border-radius:10px;font-weight:700">Potvrdi email i aktiviraj nalog</a></p><p style="font-size:12px;color:#68736e">Ako niste kreirali FiscalBox nalog, zanemarite ovu poruku.</p><p style="font-size:12px;color:#68736e;word-break:break-all">Ako dugme ne radi, otvorite: ${escapeHtml(opts.verifyUrl)}</p></div>`
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

type EmailSendResult={sent:boolean;configured:boolean;status?:number;id?:string;error?:string};

function textFromHtml(html:string){
  return html
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<br\s*\/?\s*>/gi,'\n')
    .replace(/<\/p>/gi,'\n\n')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/g,' ')
    .replace(/&amp;/g,'&')
    .replace(/&lt;/g,'<')
    .replace(/&gt;/g,'>')
    .replace(/&#39;/g,"'")
    .replace(/&quot;/g,'"')
    .replace(/[ \t]+/g,' ')
    .replace(/\n{3,}/g,'\n\n')
    .trim();
}

async function sendEmail(opts:{to:string;subject:string;html:string;attachments?:Array<{filename:string;content:string}>}):Promise<EmailSendResult>{
  const key=String(process.env.RESEND_API_KEY||'').trim();
  // fiscalbox.rs je verifikovan domen; APP_EMAIL_FROM ostaje opcioni override.
  const from=String(process.env.APP_EMAIL_FROM||'FiscalBox <noreply@fiscalbox.rs>').trim();
  const to=String(opts.to||'').trim().toLowerCase();
  if(!key||!to)return {sent:false,configured:false,error:!key?'RESEND_API_KEY nije podešen.':'Email primaoca nedostaje.'};

  let lastStatus:number|undefined;
  let lastError='';
  for(let attempt=1;attempt<=3;attempt++){
    try{
      const response=await fetch('https://api.resend.com/emails',{
        method:'POST',
        signal:AbortSignal.timeout(15000),
        headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
        body:JSON.stringify({
          from,
          to:[to],
          subject:opts.subject,
          html:opts.html,
          text:textFromHtml(opts.html),
          attachments:opts.attachments
        })
      });
      lastStatus=response.status;
      const raw=await response.text();
      let payload:any=null;
      try{payload=raw?JSON.parse(raw):null;}catch{}
      if(response.ok){
        const id=String(payload?.id||'');
        console.info('[FiscalBox mail] sent',{to,status:response.status,id:id||undefined,attempt});
        return {sent:true,configured:true,status:response.status,id:id||undefined};
      }
      lastError=String(payload?.message||payload?.error||raw||`HTTP ${response.status}`).slice(0,500);
      console.error('[FiscalBox mail] Resend rejected message',{to,status:response.status,error:lastError,attempt});
      // 4xx (osim 429) se uglavnom neće popraviti ponavljanjem.
      if(response.status<500&&response.status!==429)break;
    }catch(error:any){
      lastError=String(error?.message||error||'Greška pri slanju emaila').slice(0,500);
      console.error('[FiscalBox mail] transport error',{to,error:lastError,attempt});
    }
    if(attempt<3)await new Promise(resolve=>setTimeout(resolve,attempt*450));
  }
  return {sent:false,configured:true,status:lastStatus,error:lastError||'Resend nije prihvatio poruku.'};
}

function escapeHtml(value:string){return value.replace(/[&<>'"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]||c));}

export async function sendCustomMasterEmail(opts:{to:string;subject:string;message:string}){
  return sendEmail({
    to:opts.to,
    subject:opts.subject,
    html:`<div style="font-family:Arial,sans-serif;line-height:1.6;color:#17221E"><p>${escapeHtml(opts.message).replace(/\n/g,'<br/>')}</p><p style="font-size:12px;color:#68736e">Poruka poslata iz FiscalBox administracije.</p></div>`
  });
}
