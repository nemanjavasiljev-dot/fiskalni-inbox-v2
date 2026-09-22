import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendAccountantInvite } from '@/lib/mailer';

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.json({error:'Niste prijavljeni.'},{status:401});
  const {organization_id,accountant_pib,accountant_email}=await request.json();
  const orgId=String(organization_id||'');
  const pib=String(accountant_pib||'').replace(/\D/g,'');
  const email=String(accountant_email||'').trim().toLowerCase();
  if(!orgId) return NextResponse.json({error:'Nedostaje firma.'},{status:400});
  if(pib&&pib.length!==9) return NextResponse.json({error:'PIB knjigovođe mora imati 9 cifara.'},{status:400});
  if(email&&!EMAIL.test(email)) return NextResponse.json({error:'Email knjigovođe nije ispravan.'},{status:400});
  if(!pib&&!email) return NextResponse.json({error:'Unesite PIB ili email knjigovođe.'},{status:400});

  const {data:membership}=await supabase.from('organization_members').select('role').eq('organization_id',orgId).eq('user_id',user.id).maybeSingle();
  if(!membership||!['owner','employee'].includes(membership.role)) return NextResponse.json({error:'Nemate pravo izmene knjigovođe.'},{status:403});

  const admin=createAdminClient();
  let found=false; let accountingName='';
  if(pib){
    const {data:accountingOrg}=await admin.from('organizations').select('id,name,owner_user_id,organization_type').eq('pib',pib).limit(1).maybeSingle();
    if(accountingOrg){
      const {data:profile}=await admin.from('profiles').select('global_role').eq('user_id',accountingOrg.owner_user_id).maybeSingle();
      if(accountingOrg.organization_type==='accounting'||profile?.global_role==='accountant'){
        await admin.from('organization_members').upsert({organization_id:orgId,user_id:accountingOrg.owner_user_id,role:'accountant'},{onConflict:'organization_id,user_id'});
        await admin.from('organizations').update({accountant_pib_pending:null,accountant_contact_email:null}).eq('id',orgId);
        await admin.from('accountant_invitations').update({status:'cancelled'}).eq('organization_id',orgId).eq('status','pending');
        found=true; accountingName=accountingOrg.name;
      }
    }
  }
  if(!found){
    await admin.from('organizations').update({accountant_pib_pending:pib||null,accountant_contact_email:email||null}).eq('id',orgId);
    await admin.from('accountant_invitations').update({status:'cancelled'}).eq('organization_id',orgId).eq('status','pending');
    await admin.from('accountant_invitations').insert({organization_id:orgId,accountant_pib:pib||null,email:email||null,status:'pending',created_by:user.id});
    if(email){
      const {data:org}=await admin.from('organizations').select('name').eq('id',orgId).maybeSingle();
      try{await sendAccountantInvite({to:email,companyName:org?.name||'Klijent',registerUrl:new URL('/register',request.url).toString()});}catch{}
    }
  }
  return NextResponse.json({ok:true,found,organization_name:accountingName||null,message:found?`Povezani ste sa knjigovođom ${accountingName}.`:'Knjigovođa nije pronađen u sistemu. Kontakt je sačuvan i može se povezati kada se registruje.'});
}
