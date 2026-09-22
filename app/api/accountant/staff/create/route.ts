import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { updateSubscriptionQuantity } from '@/lib/subscriptions';

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
  const {data:membership}=await supabase.from('organization_members').select('role,accounting_access_role,organizations(id,owner_user_id,organization_type)').eq('organization_id',officeId).eq('user_id',user.id).maybeSingle();
  const office:any=(membership as any)?.organizations;
  const isAdmin=office?.organization_type==='accounting'&&(office?.owner_user_id===user.id||(membership as any)?.accounting_access_role==='admin');
  if(!isAdmin)return NextResponse.json({error:'Samo admin knjigovodstvene agencije može dodavati zaposlene.'},{status:403});
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
    const {error:mErr}=await admin.from('organization_members').insert({organization_id:officeId,user_id:newId,role:'employee',accounting_access_role:'user'});if(mErr)throw mErr;
    await admin.from('accountant_user_settings').upsert({user_id:newId,accounting_organization_id:officeId},{onConflict:'user_id,accounting_organization_id'});

    const {count}=await admin.from('organization_members').select('id',{count:'exact',head:true}).eq('organization_id',officeId).in('role',['owner','employee']);
    const seats=Math.max(1,Number(count||1));
    const {data:sub}=await admin.from('subscriptions').select('*').eq('organization_id',officeId).maybeSingle();
    if(sub?.provider_subscription_id&&['active','paused','past_due','cancelled'].includes(String(sub.status))){
      try{await updateSubscriptionQuantity(String(sub.provider_subscription_id),seats);}catch(e:any){throw new Error(`Nalog zaposlenog nije dodat jer obračun pretplate nije mogao da se ažurira: ${e?.message||'billing error'}`);}
    }
    await admin.from('subscriptions').update({seat_count:seats}).eq('organization_id',officeId);
    return NextResponse.json({ok:true,user_id:newId,username,email,full_name:fullName,seats});
  }catch(e:any){
    if(newId){try{await admin.from('organization_members').delete().eq('organization_id',officeId).eq('user_id',newId);}catch{}try{await admin.auth.admin.deleteUser(newId);}catch{}}
    return NextResponse.json({error:e?.message||'Zaposleni nije kreiran.'},{status:400});
  }
}
