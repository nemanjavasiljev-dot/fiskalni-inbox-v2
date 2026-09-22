export async function sendSms(opts:{to:string;body:string}){
  const sid=process.env.TWILIO_ACCOUNT_SID;
  const auth=process.env.TWILIO_AUTH_TOKEN;
  const from=process.env.TWILIO_FROM_NUMBER;
  if(!sid||!auth||!from||!opts.to) return {sent:false,configured:false};
  const params=new URLSearchParams({To:opts.to,From:from,Body:opts.body});
  const response=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,{
    method:'POST',
    headers:{Authorization:`Basic ${Buffer.from(`${sid}:${auth}`).toString('base64')}`,'Content-Type':'application/x-www-form-urlencoded'},
    body:params.toString()
  });
  return {sent:response.ok,configured:true,status:response.status};
}
