export async function sendAccountantInvite(opts:{to:string;companyName:string;registerUrl:string}){
  const key=process.env.RESEND_API_KEY;
  const from=process.env.APP_EMAIL_FROM;
  if(!key||!from||!opts.to) return {sent:false,configured:false};
  const response=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify({
      from,
      to:[opts.to],
      subject:`${opts.companyName} vas poziva na Fiskalni Inbox`,
      html:`<p>Firma <strong>${escapeHtml(opts.companyName)}</strong> želi da vas poveže kao knjigovođu u aplikaciji Fiskalni Inbox.</p><p>Registrujte nalog kao <strong>Knjigovođa</strong> i koristite isti email ili PIB knjigovodstvene firme. Klijenti koji su vas pozvali biće automatski povezani.</p><p><a href="${escapeHtml(opts.registerUrl)}">Registruj se na Fiskalni Inbox</a></p>`
    })
  });
  return {sent:response.ok,configured:true,status:response.status};
}

function escapeHtml(value:string){return value.replace(/[&<>'"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]||c));}
