import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME=/^[a-z0-9._-]{3,30}$/;

export async function POST(request:Request){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:'Niste prijavljeni.'},{status:401});
  const body=await request.json();
  const officeId=String(body.accounting_organization_id||'');
  const email=String(body.email||'').trim().toLowerCase();
  const username=String(body.username||'').trim().toLowerCase();
  const fullName=String(body.full_name||'').trim();
  const password=String(body.password||'');
  if(!EMAIL.test(email))return NextResponse.json({error:'Email nije ispravan.'},{status:400});
  if(!USERNAME.test(username))return NextResponse.json({error:'Korisničko ime mora imati 3–30 znakova.'},{status:400});
  if(password.length<8)return NextResponse.json({error:'Privremena lozinka mora imati najmanje 8 znakova.'},{status:400});
  const {data:office}=await supabase.from('organizations').select('id,owner_user_id,organization_type').eq('id',officeId).maybeSingle();
  if(!office||office.organization_type!=='accounting'||office.owner_user_id!==user.id)return NextResponse.json({error:'Samo admin knjigovodstvene agencije može dodavati zaposlene.'},{status:403});
  const admin=createAdminClient();
  const {data:uHit}=await admin.from('profiles').select('user_id').eq('username',username).maybeSingle();
  if(uHit)return NextResponse.json({error:'Korisničko ime je zauzeto.'},{status:409});
  const {data:eHit}=await admin.from('profiles').select('user_id').eq('auth_email',email).maybeSingle();
  if(eHit)return NextResponse.json({error:'Email već ima nalog.'},{status:409});
  let newId:string|undefined;
  try{
    const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{username,full_name:fullName,registration_role:'accountant_employee'}});
    if(created.error||!created.data.user)throw new Error(created.error?.message||'Nalog nije kreiran.');
    newId=created.data.user.id;
    const {error:pErr}=await admin.from('profiles').update({username,full_name:fullName||null,global_role:'accountant'}).eq('user_id',newId);if(pErr)throw pErr;
    const {error:mErr}=await admin.from('organization_members').insert({organization_id:officeId,user_id:newId,role:'employee'});if(mErr)throw mErr;
    await admin.from('accountant_user_settings').upsert({user_id:newId,accounting_organization_id:officeId},{onConflict:'user_id,accounting_organization_id'});
    return NextResponse.json({ok:true,user_id:newId,username,email,full_name:fullName});
  }catch(e:any){if(newId){try{await admin.auth.admin.deleteUser(newId);}catch{}}return NextResponse.json({error:e?.message||'Zaposleni nije kreiran.'},{status:400});}
}
