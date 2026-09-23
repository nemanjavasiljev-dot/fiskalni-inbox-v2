import { createHash } from 'crypto';
import { settleProforma } from '@/lib/billing';

export type NormalizedBankTransaction = {
  external_id: string;
  provider: string;
  direction: 'credit'|'debit';
  amount: number;
  currency: string;
  payer_name?: string|null;
  payer_account?: string|null;
  account_number?: string|null;
  payment_reference?: string|null;
  description?: string|null;
  booked_at?: string|null;
  raw_data: any;
};

function pick(obj:any, keys:string[]) {
  for (const key of keys) {
    const parts=key.split('.');let v=obj;
    for(const p of parts)v=v?.[p];
    if(v!==undefined&&v!==null&&v!=='')return v;
  }
  return null;
}
function num(v:any){const n=Number(String(v??'').replace(/\s/g,'').replace(',','.'));return Number.isFinite(n)?n:0;}
function iso(v:any){if(!v)return null;const d=new Date(v);return Number.isNaN(d.getTime())?null:d.toISOString();}
function normRef(v:any){return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,64);}
function refVariants(v:any){const n=normRef(v);const out=new Set<string>([n]);if(n.startsWith('00'))out.add(n.slice(2));else if(n)out.add(`00${n}`);return out;}
function hash(v:any){return createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0,40);}

export function bankApiConfigured(){return Boolean(process.env.BANK_API_URL&&process.env.BANK_API_TOKEN);}

export function normalizeBankTransaction(raw:any,provider=process.env.BANK_PROVIDER||'generic_json'):NormalizedBankTransaction|null{
  const amount=num(pick(raw,['amount','transactionAmount.amount','creditAmount','value','amount.value']));
  const directionRaw=String(pick(raw,['direction','creditDebitIndicator','type','transactionType'])||'credit').toLowerCase();
  const direction: 'credit'|'debit' = directionRaw.includes('debit')||directionRaw.includes('out')||amount<0?'debit':'credit';
  const absAmount=Math.abs(amount);
  if(!(absAmount>0))return null;
  const external=String(pick(raw,['id','transactionId','transaction_id','entryReference','referenceId','bankTransactionId'])||hash(raw));
  return {
    external_id:external,
    provider,
    direction,
    amount:absAmount,
    currency:String(pick(raw,['currency','transactionAmount.currency','amount.currency'])||'RSD').toUpperCase(),
    payer_name:pick(raw,['payer_name','payerName','debtorName','debtor.name','counterparty.name','sender.name']),
    payer_account:pick(raw,['payer_account','payerAccount','debtorAccount.iban','debtorAccount','sender.account','counterparty.account']),
    account_number:pick(raw,['account_number','accountNumber','creditorAccount.iban','creditorAccount','recipient.account']),
    payment_reference:pick(raw,['payment_reference','paymentReference','creditorReference','remittanceInformation.reference','approvalReference','modelReference','reference']),
    description:pick(raw,['description','purpose','remittanceInformation.unstructured','remittanceInformation','message','note']),
    booked_at:iso(pick(raw,['booked_at','bookedAt','bookingDate','bookingDateTime','valueDate','date','createdAt'])),
    raw_data:raw
  };
}

function extractRows(json:any){
  if(Array.isArray(json))return json;
  for(const key of ['transactions','data','items','results','entries'])if(Array.isArray(json?.[key]))return json[key];
  if(Array.isArray(json?.data?.transactions))return json.data.transactions;
  return [];
}

export async function fetchBankTransactions(){
  if(!bankApiConfigured())return {configured:false,transactions:[] as NormalizedBankTransaction[]};
  const header=process.env.BANK_API_AUTH_HEADER||'Authorization';
  const scheme=process.env.BANK_API_AUTH_SCHEME===undefined?'Bearer':process.env.BANK_API_AUTH_SCHEME;
  const token=String(process.env.BANK_API_TOKEN||'');
  const headers:Record<string,string>={Accept:'application/json'};
  headers[header]=scheme?`${scheme} ${token}`:token;
  if(process.env.BANK_API_ACCOUNT_ID)headers['X-Account-Id']=process.env.BANK_API_ACCOUNT_ID;
  const response=await fetch(String(process.env.BANK_API_URL),{headers,cache:'no-store',signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`Banka API je vratio HTTP ${response.status}.`);
  const json=await response.json();
  const transactions=extractRows(json).map((r:any)=>normalizeBankTransaction(r)).filter(Boolean) as NormalizedBankTransaction[];
  return {configured:true,transactions};
}

export async function storeTransaction(admin:any,tx:NormalizedBankTransaction){
  const payload={...tx,payment_reference:tx.payment_reference?normRef(tx.payment_reference):null,updated_at:new Date().toISOString()};
  const {data,error}=await admin.from('bank_transactions').upsert(payload,{onConflict:'external_id'}).select('*').single();
  if(error)throw error;return data;
}

export async function tryAutoMatch(admin:any,transaction:any,verifiedBy?:string|null,appBillingUrl=''){
  if(transaction.direction!=='credit'||String(transaction.currency||'RSD').toUpperCase()!=='RSD')return {matched:false};
  const {data:proformas}=await admin.from('billing_invoices').select('*').eq('document_type','proforma').eq('status','unpaid').order('issued_at',{ascending:false}).limit(1000);
  const tRefs=refVariants(transaction.payment_reference||transaction.description||'');
  const amount=Number(transaction.amount||0);
  const candidates=(proformas||[]).filter((p:any)=>{
    const pRefs=refVariants(p.payment_reference||p.invoice_number||'');
    const refMatch=[...tRefs].some(r=>r&&pRefs.has(r)) || String(transaction.description||'').toUpperCase().includes(String(p.invoice_number||'').toUpperCase());
    return refMatch && Math.abs(Number(p.total_amount||0)-amount)<0.01;
  });
  if(candidates.length!==1)return {matched:false,candidates:candidates.length};
  const settled=await settleProforma({admin,proformaId:String(candidates[0].id),bankTransactionId:String(transaction.id),verifiedBy:verifiedBy||null,verificationSource:'BANK_API_AUTO',paidAt:transaction.booked_at||new Date().toISOString(),appBillingUrl});
  return {matched:true,invoice:settled.invoice};
}

export async function syncBankTransactions(admin:any,verifiedBy?:string|null,appBillingUrl=''){
  const feed=await fetchBankTransactions();
  if(!feed.configured)return {configured:false,seen:0,inserted:0,matched:0};
  let inserted=0,matched=0;
  for(const tx of feed.transactions){
    if(tx.direction!=='credit')continue;
    const row=await storeTransaction(admin,tx);inserted++;
    if(row.status==='unmatched'){
      const result=await tryAutoMatch(admin,row,verifiedBy,appBillingUrl);
      if(result.matched)matched++;
    }
  }
  return {configured:true,seen:feed.transactions.length,inserted,matched};
}
