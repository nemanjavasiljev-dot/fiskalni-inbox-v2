import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createPlanProforma } from '@/lib/billing';

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME=/^[a-z0-9._-]{3,40}$/;

async function checked(query:any){const result=await query;if(result.error)throw result.error;return result;}

export async function POST(request:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:'Niste prijavljeni.'},{status:401});

  const body=await request.json().catch(()=>({}));
  const companyId=String(body.company_id||'');
  const email=String(body.email||'').trim().toLowerCase();
  const username=String(body.username||'').trim().toLowerCase();
  const password=String(body.password||'');
  const plan=body.plan==='premium'?'premium':'basic';

  if(!companyId)return NextResponse.json({error:'Izaberite klijenta iz APR/NBS pretrage.'},{status:400});
  if(!EMAIL.test(email))return NextResponse.json({error:'Unesite ispravan email klijenta.'},{status:400});
  if(!USERNAME.test(username))return NextResponse.json({error:'Korisničko ime mora imati 3–40 znakova: mala slova, brojevi, tačka, crtica ili donja crta.'},{status:400});
  if(password.length<10||!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/[0-9]/.test(password))return NextResponse.json({error:'Lozinka mora imati najmanje 10 znakova i sadržati veliko slovo, malo slovo i broj.'},{status:400});

  const {data:officeMemberships}=await supabase.from('organization_members')
    .select('organization_id,role,accounting_access_role,organizations(id,name,owner_user_id,organization_type)')
    .eq('user_id',user.id).in('role',['owner','employee']);
  const officeMembership:any=(officeMemberships||[]).find((m:any)=>m.organizations?.organization_type==='accounting');
  if(!officeMembership)return NextResponse.json({error:'Nalog nije povezan sa knjigovodstvenom agencijom.'},{status:403});
  if(officeMembership.role!=='owner'&&officeMembership.accounting_access_role!=='admin')return NextResponse.json({error:'Samo ADMIN knjigovođa može ručno kreirati nalog klijenta.'},{status:403});

  const office:any=officeMembership.organizations;
  const admin=createAdminClient();
  const {data:company}=await admin.from('companies').select('*').eq('id',companyId).maybeSingle();
  if(!company)return NextResponse.json({error:'Firma nije pronađena u centralnoj bazi.'},{status:404});

  const [{data:existingOrg},{data:emailHit},{data:usernameHit}]=await Promise.all([
    admin.from('organizations').select('id,name').eq('company_id',companyId).eq('organization_type','company').limit(1).maybeSingle(),
    admin.from('profiles').select('user_id').eq('auth_email',email).maybeSingle(),
    admin.from('profiles').select('user_id').eq('username',username).maybeSingle(),
  ]);
  if(existingOrg)return NextResponse.json({error:`${existingOrg.name||'Firma'} već ima FiscalBox nalog. Za postojeći nalog koristite email zahtev za povezivanje.`},{status:409});
  if(emailHit)return NextResponse.json({error:'Ovaj email već ima FiscalBox nalog.'},{status:409});
  if(usernameHit)return NextResponse.json({error:'Korisničko ime je zauzeto. Generišite drugo.'},{status:409});

  let userId:string|undefined;
  let orgId:string|undefined;
  try{
    // Ručno kreiran klijent ne prolazi email potvrdu: knjigovođa mu direktno dodeljuje kredencijale.
    const created=await admin.auth.admin.createUser({
      email,
      password,
      email_confirm:true,
      user_metadata:{username,registration_role:'company',created_by_accountant:true,accounting_organization_id:office.id}
    });
    if(created.error||!created.data.user)throw new Error(created.error?.message||'Korisnički nalog nije kreiran.');
    userId=created.data.user.id;

    await checked(admin.from('profiles').upsert({user_id:userId,auth_email:email,username,global_role:'user',primary_company_id:company.id},{onConflict:'user_id'}));
    const now=new Date();
    const trialEnd=new Date(now.getTime()+10*24*60*60*1000).toISOString();
    const {data:org,error:orgError}=await admin.from('organizations').insert({
      company_id:company.id,
      name:company.name,
      pib:company.pib,
      registration_number:company.registration_number,
      legal_form:company.legal_form,
      address:company.address,
      municipality:company.municipality||company.city,
      activity_code:company.activity_code,
      activity_name:company.activity_name,
      apr_raw:company.apr_raw||null,
      owner_user_id:userId,
      plan,
      status:'trial',
      organization_type:'company',
      trial_ends_at:trialEnd,
      contact_email:email
    }).select('id').single();
    if(orgError||!org)throw orgError||new Error('Firma nije kreirana.');
    orgId=org.id;

    await checked(admin.from('organization_members').insert({organization_id:org.id,user_id:userId,role:'owner'}));
    await checked(admin.from('subscriptions').insert({
      organization_id:org.id,company_id:company.id,plan,seat_count:1,status:'trial',
      trial_started_at:now.toISOString(),trial_ends_at:trialEnd,trial_used_at:now.toISOString(),current_period_end:trialEnd,
      auto_proforma_enabled:true
    }));

    await checked(admin.from('accountant_company').upsert({
      accountant_organization_id:office.id,company_id:company.id,client_organization_id:org.id,status:'active',
      requested_by:user.id,approved_by:user.id,approved_at:now.toISOString(),updated_at:now.toISOString()
    },{onConflict:'accountant_organization_id,company_id'}));

    if(office.owner_user_id)await checked(admin.from('organization_members').upsert({organization_id:org.id,user_id:office.owner_user_id,role:'accountant'},{onConflict:'organization_id,user_id'}));
    if(user.id!==office.owner_user_id){
      await checked(admin.from('organization_members').upsert({organization_id:org.id,user_id:user.id,role:'accountant'},{onConflict:'organization_id,user_id'}));
      await checked(admin.from('accountant_client_assignments').upsert({accounting_organization_id:office.id,employee_user_id:user.id,client_organization_id:org.id,assigned_by:user.id},{onConflict:'accounting_organization_id,employee_user_id,client_organization_id'}));
    }

    let proforma:any=null;let proformaError:string|null=null;
    try{
      const origin=new URL(process.env.NEXT_PUBLIC_APP_URL||request.url).origin;
      proforma=await createPlanProforma({admin,organization:{...company,...org,id:org.id,company_id:company.id,name:company.name,pib:company.pib,registration_number:company.registration_number,address:company.address},plan,seats:1,recipientEmail:email,appBillingUrl:`${origin}/app/billing`});
    }catch(e:any){proformaError=e?.message||'Predračun nije automatski kreiran.';}

    return NextResponse.json({
      ok:true,
      organization_id:org.id,
      company_name:company.name,
      email,
      username,
      selected_plan:plan,
      email_confirmation_required:false,
      proforma_id:proforma?.invoice?.id||null,
      proforma_error:proformaError,
      message:proformaError?'Nalog je kreiran bez email potvrde, ali predračun treba proveriti u MASTER-u.':'Nalog je kreiran i aktivan bez email potvrde. Predračun je automatski kreiran.'
    });
  }catch(e:any){
    if(orgId){try{await admin.from('organizations').delete().eq('id',orgId);}catch{}}
    if(userId){try{await admin.auth.admin.deleteUser(userId);}catch{}}
    return NextResponse.json({error:e?.message||'Ručno kreiranje klijenta nije uspelo.'},{status:400});
  }
}
