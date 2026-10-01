import { NextResponse } from 'next/server';
import { requireMaster } from '@/lib/master-auth';
import { purgeOrganizationStorage } from './delete-helper';

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


export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){
  const ctx=await requireMaster();
  if(!ctx.ok)return NextResponse.json({error:ctx.error},{status:ctx.status});
  const {id}=await params;
  const body=await request.json().catch(()=>({}));
  const {data:org,error:orgError}=await ctx.admin.from('organizations').select('*').eq('id',id).maybeSingle();
  if(orgError||!org)return NextResponse.json({error:'Organizacija nije pronađena.'},{status:404});

  if(body.confirm!==true){
    return NextResponse.json({error:'Brisanje nije potvrđeno.'},{status:400});
  }
  const expectedDeletePin=String(process.env.MASTER_DELETE_PIN||'5203').trim();
  const suppliedDeletePin=String(body.pin||'').trim();
  if(!suppliedDeletePin||suppliedDeletePin!==expectedDeletePin){
    return NextResponse.json({error:'Pogrešan SUPER ADMIN PIN. Brisanje nije izvršeno.'},{status:403});
  }
  if(String(org.owner_user_id)===String(ctx.user.id)){
    return NextResponse.json({error:'SUPER ADMIN ne može obrisati sopstveni master nalog kroz brisanje organizacije.'},{status:400});
  }

  const {data:memberRows}=await ctx.admin.from('organization_members').select('user_id,role').eq('organization_id',id);
  const localMemberIds=(memberRows||[]).filter((m:any)=>['owner','employee'].includes(String(m.role))).map((m:any)=>String(m.user_id));
  const candidateUserIds=Array.from(new Set([String(org.owner_user_id),...localMemberIds].filter(Boolean)));

  const [{count:receiptCount},{count:documentCount},{count:memberCount},{count:invoiceCount}]=await Promise.all([
    ctx.admin.from('receipts').select('id',{count:'exact',head:true}).eq('organization_id',id),
    ctx.admin.from('documents').select('id',{count:'exact',head:true}).eq('organization_id',id),
    ctx.admin.from('organization_members').select('id',{count:'exact',head:true}).eq('organization_id',id),
    ctx.admin.from('billing_invoices').select('id',{count:'exact',head:true}).eq('organization_id',id),
  ]);

  const {error:deleteError}=await ctx.admin.from('organizations').delete().eq('id',id);
  if(deleteError)return NextResponse.json({error:`Organizacija nije obrisana: ${deleteError.message}`},{status:400});

  let storage:Record<string,number>={};
  let storageWarning:string|null=null;
  try{storage=await purgeOrganizationStorage(ctx.admin,id);}catch(e:any){storageWarning=e?.message||'Storage fajlovi nisu u potpunosti očišćeni.';}

  const deletedUsers:string[]=[];
  const retainedUsers:string[]=[];
  for(const userId of candidateUserIds){
    const [{count:membershipCount},{count:ownedOrgCount},{data:profile}]=await Promise.all([
      ctx.admin.from('organization_members').select('id',{count:'exact',head:true}).eq('user_id',userId),
      ctx.admin.from('organizations').select('id',{count:'exact',head:true}).eq('owner_user_id',userId),
      ctx.admin.from('profiles').select('global_role').eq('user_id',userId).maybeSingle(),
    ]);
    const keep=Number(membershipCount||0)>0||Number(ownedOrgCount||0)>0||profile?.global_role==='master_admin';
    if(keep){retainedUsers.push(userId);continue;}
    const {error:userDeleteError}=await ctx.admin.auth.admin.deleteUser(userId);
    if(userDeleteError)retainedUsers.push(userId);else deletedUsers.push(userId);
  }

  await ctx.admin.from('master_action_log').insert({
    action:'organization_deleted',organization_id:null,created_by:ctx.user.id,
    details:{
      deleted_organization_id:id,
      deleted_name:org.name,
      deleted_pib:org.pib||null,
      organization_type:org.organization_type||'company',
      counts:{receipts:receiptCount||0,documents:documentCount||0,members:memberCount||0,billing_invoices:invoiceCount||0},
      deleted_users:deletedUsers.length,retained_shared_users:retainedUsers.length,storage,storage_warning:storageWarning
    }
  });

  return NextResponse.json({
    ok:true,
    message:org.organization_type==='accounting'?'Knjigovođa je trajno obrisan iz FiscalBox baze.':'Firma je trajno obrisana iz FiscalBox baze.',
    deleted:{organization_id:id,name:org.name,type:org.organization_type||'company'},
    deleted_users:deletedUsers.length,
    retained_shared_users:retainedUsers.length,
    storage,
    storage_warning:storageWarning
  });
}
