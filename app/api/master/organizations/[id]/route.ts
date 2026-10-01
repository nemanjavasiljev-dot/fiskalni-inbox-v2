import { NextResponse } from 'next/server';
import { requireMaster } from '@/lib/master-auth';

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const digits=(v:unknown)=>String(v??'').replace(/\D/g,'');
const clean=(v:unknown,max=300)=>String(v??'').trim().slice(0,max);

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const ctx=await requireMaster();
  if(!ctx.ok)return NextResponse.json({error:ctx.error},{status:ctx.status});
  const {id}=await params;
  const body=await request.json().catch(()=>({}));
  const {data:org,error:orgError}=await ctx.admin.from('organizations').select('*').eq('id',id).maybeSingle();
  if(orgError||!org)return NextResponse.json({error:'Organizacija nije pronađena.'},{status:404});

  const name=clean(body.name,220);
  const pib=digits(body.pib);
  const mb=digits(body.registration_number);
  const contactEmail=clean(body.contact_email,220).toLowerCase();
  const plan=String(body.plan||org.plan||'basic').toLowerCase();
  if(!name)return NextResponse.json({error:'Naziv firme je obavezan.'},{status:400});
  if(pib&&pib.length!==9)return NextResponse.json({error:'PIB mora imati 9 cifara.'},{status:400});
  if(mb&&mb.length!==8)return NextResponse.json({error:'Matični broj mora imati 8 cifara.'},{status:400});
  if(contactEmail&&!EMAIL.test(contactEmail))return NextResponse.json({error:'Email nije ispravan.'},{status:400});
  if(org.organization_type!=='accounting'&&!['basic','premium'].includes(plan))return NextResponse.json({error:'Paket mora biti BASIC ili PREMIUM.'},{status:400});

  const update:any={
    name,
    pib:pib||null,
    registration_number:mb||null,
    legal_form:clean(body.legal_form,140)||null,
    address:clean(body.address,300)||null,
    municipality:clean(body.municipality,140)||null,
    activity_code:clean(body.activity_code,20)||null,
    activity_name:clean(body.activity_name,220)||null,
    contact_email:contactEmail||null,
    contact_phone:clean(body.contact_phone,50)||null,
  };
  if(org.organization_type!=='accounting')update.plan=plan;
  const {data:saved,error}=await ctx.admin.from('organizations').update(update).eq('id',id).select('*').single();
  if(error)return NextResponse.json({error:error.message},{status:400});

  if(org.organization_type!=='accounting'){
    const {data:sub}=await ctx.admin.from('subscriptions').select('id').eq('organization_id',id).maybeSingle();
    if(sub?.id)await ctx.admin.from('subscriptions').update({plan}).eq('id',sub.id);
  }
  await ctx.admin.from('master_action_log').insert({
    action:'organization_edited',organization_id:id,created_by:ctx.user.id,
    details:{organization_type:org.organization_type,plan:org.organization_type==='accounting'?null:plan,fields:Object.keys(update)}
  });
  return NextResponse.json({ok:true,organization:saved,message:'Podaci organizacije su sačuvani.'});
}
