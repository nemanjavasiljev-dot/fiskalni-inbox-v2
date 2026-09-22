export async function sendAccountantInvite(opts:{to:string;companyName:string;registerUrl:string}){
  return sendEmail({
    to:opts.to,
    subject:`${opts.companyName} vas poziva na Fiskalni Inbox`,
    html:`<p>Firma <strong>${escapeHtml(opts.companyName)}</strong> želi da vas poveže kao knjigovođu u aplikaciji Fiskalni Inbox.</p><p>Registrujte nalog kao <strong>Knjigovođa</strong> i koristite isti email ili PIB knjigovodstvene firme. Klijenti koji su vas pozvali biće automatski povezani.</p><p><a href="${escapeHtml(opts.registerUrl)}">Registruj se na Fiskalni Inbox</a></p>`
  });
}

export async function sendClientInvite(opts:{to:string;accountingOffice:string;companyName:string;inviteUrl:string}){
  return sendEmail({
    to:opts.to,
    subject:`Poziv za Fiskalni Inbox · ${opts.companyName}`,
    html:`<p>Knjigovodstvena agencija <strong>${escapeHtml(opts.accountingOffice)}</strong> vas poziva da aktivirate firmu <strong>${escapeHtml(opts.companyName)}</strong> u aplikaciji Fiskalni Inbox.</p><p>Kliknite na dugme i postavite svoju lozinku. Podaci firme i veza sa knjigovođom su već pripremljeni.</p><p><a href="${escapeHtml(opts.inviteUrl)}" style="display:inline-block;padding:12px 18px;background:#0f6b4f;color:#fff;text-decoration:none;border-radius:10px">Aktiviraj Fiskalni Inbox</a></p><p style="font-size:12px;color:#68736e">Ako dugme ne radi, otvorite: ${escapeHtml(opts.inviteUrl)}</p>`
  });
}

async function sendEmail(opts:{to:string;subject:string;html:string}){
  const key=process.env.RESEND_API_KEY;
  const from=process.env.APP_EMAIL_FROM;
  if(!key||!from||!opts.to) return {sent:false,configured:false};
  const response=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify({from,to:[opts.to],subject:opts.subject,html:opts.html})
  });
  return {sent:response.ok,configured:true,status:response.status};
}

function escapeHtml(value:string){return value.replace(/[&<>'"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]||c));}
