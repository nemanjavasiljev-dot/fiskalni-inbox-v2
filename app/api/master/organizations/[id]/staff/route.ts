import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { requireMaster } from '@/lib/master-auth';

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME=/^[a-z0-9._-]{3,30}$/;
const clean=(v:unknown,max=180)=>String(v??'').trim().slice(0,max);
function slug(value:string){return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'.').replace(/^\.+|\.+$/g,'').slice(0,22)||'korisnik';}
function generatedPassword(){return `Fb!${randomBytes(9).toString('base64url')}9a`;}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const ctx=await requireMaster();if(!ctx.ok)return NextResponse.json({error:ctx.error},{status:ctx.status});
  const {id}=await params;const body=await request.json().catch(()=>({}));const action=String(body.action||'create');
  const {data:org}=await ctx.admin.from('organizations').select('id,name,organization_type,owner_user_id').eq('id',id).maybeSingle();
  if(!org)return NextResponse.json({error:'Organizacija nije pronađena.'},{status:404});

  if(action==='create'){
    const email=clean(body.email,220).toLowerCase();const fullName=clean(body.full_name,160);
    const accessRole=String(body.access_role||'user')==='admin'?'admin':'user';
    if(!EMAIL.test(email))return NextResponse.json({error:'Unesite ispravnu email adresu.'},{status:400});
    let username=clean(body.username,30).toLowerCase();
    if(!username)username=`${slug(fullName||email.split('@')[0])}.${randomBytes(2).toString('hex')}`.slice(0,30);
    if(!USERNAME.test(username))return NextResponse.json({error:'Korisničko ime mora imati 3–30 znakova i može sadržati slova, brojeve, tačku, _ i -.'},{status:400});
    const {data:uName}=await ctx.admin.from('profiles').select('user_id').eq('username',username).maybeSingle();
    if(uName)return NextResponse.json({error:'Korisničko ime je zauzeto.'},{status:409});

    const {data:existingProfile}=await ctx.admin.from('profiles').select('user_id,auth_email,username,full_name,global_role').eq('auth_email',email).maybeSingle();
    let userId=String(existingProfile?.user_id||'');let password='';let created=false;
    try{
      if(!userId){
        password=clean(body.password,120)||generatedPassword();
        if(password.length<8)return NextResponse.json({error:'Lozinka mora imati najmanje 8 znakova.'},{status:400});
        const createdUser=await ctx.admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{username,full_name:fullName,created_by_master:true}});
        if(createdUser.error||!createdUser.data.user)throw new Error(createdUser.error?.message||'Korisnik nije kreiran.');
        userId=createdUser.data.user.id;created=true;
        const globalRole=org.organization_type==='accounting'?'accountant':'user';
        const {error:pErr}=await ctx.admin.from('profiles').update({username,full_name:fullName||null,global_role:globalRole}).eq('user_id',userId);if(pErr)throw pErr;
      }
      const {data:old}=await ctx.admin.from('organization_members').select('id').eq('organization_id',id).eq('user_id',userId).maybeSingle();
      if(old)return NextResponse.json({error:'Ovaj korisnik je već član organizacije.'},{status:409});
      if(!created&&org.organization_type==='accounting'&&existingProfile?.global_role!=='master_admin'){
        const {error:roleErr}=await ctx.admin.from('profiles').update({global_role:'accountant'}).eq('user_id',userId);
        if(roleErr)throw roleErr;
      }
      const membership:any={organization_id:id,user_id:userId,role:'employee',organization_access_role:accessRole};
      if(org.organization_type==='accounting')membership.accounting_access_role=accessRole;
      const {data:m,error:mErr}=await ctx.admin.from('organization_members').insert(membership).select('*').single();if(mErr)throw mErr;
      if(org.organization_type==='accounting')await ctx.admin.from('accountant_user_settings').upsert({user_id:userId,accounting_organization_id:id},{onConflict:'user_id,accounting_organization_id'});
      await ctx.admin.from('master_action_log').insert({action:'organization_staff_added',organization_id:id,target_user_id:userId,created_by:ctx.user.id,details:{access_role:accessRole,existing_user:!created}});
      return NextResponse.json({ok:true,membership:m,created_user:created,credentials:created?{email,username,password}:null,message:created?'Zaposleni je kreiran i dodat. Sačuvajte kredencijale.':'Postojeći FiscalBox korisnik je dodat u organizaciju.'});
    }catch(e:any){
      if(created&&userId){try{await ctx.admin.auth.admin.deleteUser(userId);}catch{}}
      return NextResponse.json({error:e?.message||'Zaposleni nije dodat.'},{status:400});
    }
  }

  const membershipId=clean(body.membership_id,80);
  const {data:m}=await ctx.admin.from('organization_members').select('id,user_id,role,organization_id').eq('id',membershipId).eq('organization_id',id).maybeSingle();
  if(!m)return NextResponse.json({error:'Član organizacije nije pronađen.'},{status:404});
  const owner=String(m.user_id)===String(org.owner_user_id)||m.role==='owner';
  if(action==='role'){
    if(owner)return NextResponse.json({error:'Vlasnik organizacije mora ostati ADMIN.'},{status:400});
    const accessRole=String(body.access_role||'user')==='admin'?'admin':'user';
    const update:any={organization_access_role:accessRole};if(org.organization_type==='accounting')update.accounting_access_role=accessRole;
    const {error}=await ctx.admin.from('organization_members').update(update).eq('id',membershipId);if(error)return NextResponse.json({error:error.message},{status:400});
    await ctx.admin.from('master_action_log').insert({action:'organization_staff_role_changed',organization_id:id,target_user_id:m.user_id,created_by:ctx.user.id,details:{access_role:accessRole}});
    return NextResponse.json({ok:true,message:'Privilegija zaposlenog je promenjena.'});
  }
  if(action==='remove'){
    if(owner)return NextResponse.json({error:'Vlasnik organizacije ne može biti uklonjen.'},{status:400});
    if(org.organization_type==='accounting'){
      const {data:assignments}=await ctx.admin.from('accountant_client_assignments').select('client_organization_id').eq('accounting_organization_id',id).eq('employee_user_id',m.user_id);
      for(const a of assignments||[])await ctx.admin.from('organization_members').delete().eq('organization_id',a.client_organization_id).eq('user_id',m.user_id).eq('role','accountant');
      await ctx.admin.from('accountant_client_assignments').delete().eq('accounting_organization_id',id).eq('employee_user_id',m.user_id);
      await ctx.admin.from('accountant_user_settings').delete().eq('accounting_organization_id',id).eq('user_id',m.user_id);
    }
    const {error}=await ctx.admin.from('organization_members').delete().eq('id',membershipId);if(error)return NextResponse.json({error:error.message},{status:400});
    if(org.organization_type==='accounting'){
      const {data:remaining}=await ctx.admin.from('organization_members').select('organization_id,role,organizations!inner(organization_type)').eq('user_id',m.user_id).in('role',['owner','employee']).eq('organizations.organization_type','accounting').limit(1);
      if(!(remaining||[]).length)await ctx.admin.from('profiles').update({global_role:'user'}).eq('user_id',m.user_id).neq('global_role','master_admin');
    }
    await ctx.admin.from('master_action_log').insert({action:'organization_staff_removed',organization_id:id,target_user_id:m.user_id,created_by:ctx.user.id,details:{membership_id:membershipId}});
    return NextResponse.json({ok:true,message:'Zaposleni je uklonjen iz organizacije. Korisnički nalog nije obrisan.'});
  }
  return NextResponse.json({error:'Nepoznata akcija.'},{status:400});
}
