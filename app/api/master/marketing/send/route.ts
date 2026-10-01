import { NextResponse } from 'next/server';
import { requireMaster } from '@/lib/master-auth';
import { sendCustomMasterEmail } from '@/lib/mailer';

const MAX_TOTAL=20*1024*1024;
const clean=(v:unknown,max=10000)=>String(v??'').trim().slice(0,max);

type Att={name:string;path:string;mime_type?:string;size_bytes?:number};
export async function POST(request:Request){
  const ctx=await requireMaster();if(!ctx.ok)return NextResponse.json({error:ctx.error},{status:ctx.status});
  const body=await request.json().catch(()=>({}));
  const ids:string[]=Array.from(new Set<string>(Array.isArray(body.organization_ids)?body.organization_ids.map((x:unknown)=>String(x)).filter(Boolean):[]));
  const subject=clean(body.subject,250),message=clean(body.message,15000),name=clean(body.name,180);
  const files:Att[]=Array.isArray(body.attachments)?body.attachments.slice(0,5).map((a:any)=>({name:clean(a?.name,140),path:clean(a?.path,500),mime_type:clean(a?.mime_type,120),size_bytes:Number(a?.size_bytes||0)})).filter((a:Att)=>a.name&&a.path):[];
  if(!ids.length)return NextResponse.json({error:'Izaberite najmanje jednog primaoca.'},{status:400});
  if(!subject||!message)return NextResponse.json({error:'Naslov i marketing poruka su obavezni.'},{status:400});
  const total=files.reduce((s,a)=>s+Math.max(0,Number(a.size_bytes||0)),0);if(total>MAX_TOTAL)return NextResponse.json({error:'Ukupna veličina priloga ne sme preći 20 MB.'},{status:400});

  const {data:orgs,error:orgError}=await ctx.admin.from('organizations').select('id,company_id,name,organization_type,contact_email,owner_user_id').in('id',ids);
  if(orgError)return NextResponse.json({error:orgError.message},{status:400});
  const owners=(orgs||[]).map((o:any)=>o.owner_user_id).filter(Boolean);
  const companyIds=(orgs||[]).map((o:any)=>o.company_id).filter(Boolean);
  const [{data:profiles},{data:registryCompanies}]=await Promise.all([
    owners.length?ctx.admin.from('profiles').select('user_id,auth_email').in('user_id',owners):Promise.resolve({data:[] as any[]} as any),
    companyIds.length?ctx.admin.from('companies').select('id,contact_email').in('id',companyIds):Promise.resolve({data:[] as any[]} as any),
  ]);
  const emailMap=new Map((profiles||[]).map((p:any)=>[String(p.user_id),String(p.auth_email||'')]));
  const registryEmailMap=new Map((registryCompanies||[]).map((c:any)=>[String(c.id),String(c.contact_email||'')]));

  const attachments:Array<{filename:string;content:string}>=[];
  for(const f of files){
    if(!f.path.startsWith(`drafts/${ctx.user.id}/`))return NextResponse.json({error:'Neispravan marketing prilog.'},{status:403});
    const {data,error}=await ctx.admin.storage.from('marketing-assets').download(f.path);if(error||!data)return NextResponse.json({error:`Prilog ${f.name} nije dostupan.`},{status:400});
    const buf=Buffer.from(await data.arrayBuffer());if(buf.length>10*1024*1024)return NextResponse.json({error:`Prilog ${f.name} je veći od 10 MB.`},{status:400});
    attachments.push({filename:f.name,content:buf.toString('base64')});
  }

  const {data:campaign,error:cErr}=await ctx.admin.from('marketing_campaigns').insert({name:name||subject,subject,body:message,target_kind:'selected',target_organization_ids:ids,recipient_count:0,sent_count:0,failed_count:0,status:'sending',created_by:ctx.user.id}).select('*').single();
  if(cErr)return NextResponse.json({error:cErr.message},{status:400});
  if(files.length)await ctx.admin.from('marketing_campaign_attachments').insert(files.map(f=>({campaign_id:campaign.id,file_name:f.name,storage_path:f.path,mime_type:f.mime_type||null,size_bytes:f.size_bytes||0})));

  let sent=0,failed=0;const emails=new Set<string>();
  for(const o of orgs||[]){
    const to=String(o.contact_email||registryEmailMap.get(String(o.company_id))||emailMap.get(String(o.owner_user_id))||'').trim().toLowerCase();
    if(!to||emails.has(to))continue;emails.add(to);
    const result=await sendCustomMasterEmail({to,subject,message,attachments,marketing:true});
    if(result.sent)sent++;else failed++;
  }
  const status=sent&&failed?'partial':sent?'sent':'failed';
  await ctx.admin.from('marketing_campaigns').update({recipient_count:emails.size,sent_count:sent,failed_count:failed,status,sent_at:new Date().toISOString()}).eq('id',campaign.id);
  await ctx.admin.from('master_notification_log').insert({channel:'email',target_kind:'selected',target_organization_ids:ids,target_company_ids:(orgs||[]).map((o:any)=>o.company_id).filter(Boolean),subject,body:message,recipient_count:emails.size,sent_count:sent,created_by:ctx.user.id,marketing_campaign_id:campaign.id,attachment_names:files.map(f=>f.name)});
  await ctx.admin.from('master_action_log').insert({action:'marketing_campaign_sent',created_by:ctx.user.id,details:{campaign_id:campaign.id,recipient_count:emails.size,sent_count:sent,failed_count:failed,attachments:files.map(f=>f.name)}});
  return NextResponse.json({ok:true,campaign_id:campaign.id,recipient_count:emails.size,sent_count:sent,failed_count:failed,configured:Boolean(process.env.RESEND_API_KEY&&process.env.APP_EMAIL_FROM),message:`Marketing poruka poslata: ${sent}/${emails.size}.`});
}
