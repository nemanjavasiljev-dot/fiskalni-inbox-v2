import JSZip from 'jszip';
import { buildReceiptArchivePdf } from '@/lib/simple-pdf';

function ym(value:any){if(!value)return '';const d=new Date(value);if(Number.isNaN(d.getTime()))return '';return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
function yy(value:any){if(!value)return '';const d=new Date(value);if(Number.isNaN(d.getTime()))return '';return String(d.getFullYear());}
function inPeriod(value:any,month?:string,year?:string){return year?yy(value)===year:ym(value)===month;}
function cleanName(value:any){return String(value||'fajl').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._ -]+/g,'_').replace(/\s+/g,' ').trim().slice(0,90)||'fajl';}
function receiptName(r:any,index:number){return `${String(index+1).padStart(3,'0')}_${cleanName(r.merchant_name||'racun')}_${cleanName(r.invoice_number||r.id)}.pdf`;}

export async function buildAccountantArchive(opts:{admin:any;accountantUserId:string;organizationIds:string[];type:'receipts'|'documents';month?:string;year?:string}){
  const orgIds=Array.from(new Set(opts.organizationIds.filter(Boolean)));if(!orgIds.length)throw new Error('Nema povezanih klijenata.');
  const {data:orgs}=await opts.admin.from('organizations').select('id,name,pib').in('id',orgIds);const orgMap=new Map((orgs||[]).map((o:any)=>[String(o.id),o]));
  const zip=new JSZip();const now=new Date().toISOString();let count=0;
  if(opts.type==='receipts'){
    const {data:rows,error}=await opts.admin.from('receipts').select('*').in('organization_id',orgIds).not('sent_to_accountant_at','is',null).order('sdc_time',{ascending:false}).limit(5000);if(error)throw error;
    const receipts=(rows||[]).filter((r:any)=>inPeriod(r.sdc_time||r.created_at,opts.month,opts.year));
    const statusRows:any[]=[];
    receipts.forEach((r:any,index:number)=>{const org:any=orgMap.get(String(r.organization_id));const folder=`${cleanName(org?.name||'Klijent')}/Racuni`;zip.file(`${folder}/${receiptName(r,index)}`,buildReceiptArchivePdf(r,org));statusRows.push({accountant_user_id:opts.accountantUserId,organization_id:r.organization_id,receipt_id:r.id,opened_at:now,downloaded_at:now,updated_at:now});});
    if(statusRows.length)await opts.admin.from('accountant_receipt_status').upsert(statusRows,{onConflict:'accountant_user_id,receipt_id'});count=receipts.length;
  }else{
    const {data:rows,error}=await opts.admin.from('documents').select('*').in('organization_id',orgIds).eq('status','sent').order('sent_at',{ascending:false}).limit(5000);if(error)throw error;
    const docs=(rows||[]).filter((d:any)=>inPeriod(d.sent_at||d.created_at,opts.month,opts.year));const statusRows:any[]=[];
    for(const d of docs){const org:any=orgMap.get(String(d.organization_id));const {data,error:downloadError}=await opts.admin.storage.from('documents').download(String(d.storage_path));if(downloadError||!data)continue;const buf=Buffer.from(await data.arrayBuffer());const folder=`${cleanName(org?.name||'Klijent')}/Dokumenti`;zip.file(`${folder}/${cleanName(d.file_name||d.id)}`,buf);statusRows.push({accountant_user_id:opts.accountantUserId,organization_id:d.organization_id,document_id:d.id,opened_at:now,downloaded_at:now,updated_at:now});count++;}
    if(statusRows.length)await opts.admin.from('accountant_document_status').upsert(statusRows,{onConflict:'accountant_user_id,document_id'});
  }
  if(!count)throw new Error(opts.type==='receipts'?'Nema primljenih računa za izabrani period.':'Nema primljenih dokumenata za izabrani period.');
  const content=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}});return {content,count};
}
