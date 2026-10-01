import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireMaster } from '@/lib/master-auth';

const MAX_FILE=10*1024*1024;
const ALLOWED=new Set(['application/pdf','image/jpeg','image/png','image/webp','text/plain','text/csv','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
function safeName(v:string){return v.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,120)||'prilog';}

export async function POST(request:Request){
  const ctx=await requireMaster();if(!ctx.ok)return NextResponse.json({error:ctx.error},{status:ctx.status});
  const form=await request.formData();const file=form.get('file');
  if(!(file instanceof File))return NextResponse.json({error:'Fajl nije prosleđen.'},{status:400});
  if(file.size<=0||file.size>MAX_FILE)return NextResponse.json({error:'Fajl mora biti manji od 10 MB.'},{status:400});
  const mime=String(file.type||'application/octet-stream').toLowerCase();
  if(!ALLOWED.has(mime))return NextResponse.json({error:'Tip fajla nije dozvoljen za marketing prilog.'},{status:400});
  const name=safeName(file.name);const path=`drafts/${ctx.user.id}/${Date.now()}-${randomUUID()}-${name}`;
  const bytes=new Uint8Array(await file.arrayBuffer());
  const {error}=await ctx.admin.storage.from('marketing-assets').upload(path,bytes,{contentType:mime,upsert:false,cacheControl:'3600'});
  if(error)return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({ok:true,file:{name,path,mime_type:mime,size_bytes:file.size}});
}
