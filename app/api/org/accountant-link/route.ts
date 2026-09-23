import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createAccountantVerificationInvite, normalizeEmail, normalizePib } from '@/lib/accountant-verification';

export async function POST(request:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:'Niste prijavljeni.'},{status:401});
  const body=await request.json().catch(()=>({}));
  const orgId=String(body.organization_id||'');
  const accountantPib=normalizePib(body.accountant_pib);
  const accountantEmail=normalizeEmail(body.accountant_email);
  if(!orgId)return NextResponse.json({error:'Nedostaje firma koja šalje zahtev.'},{status:400});
  if(!/^\d{9}$/.test(accountantPib))return NextResponse.json({error:'PIB knjigovođe mora imati tačno 9 cifara.'},{status:400});
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountantEmail))return NextResponse.json({error:'Unesite ispravan email knjigovođe.'},{status:400});

  const {data:membership}=await supabase.from('organization_members').select('role').eq('organization_id',orgId).eq('user_id',user.id).maybeSingle();
  if(!membership||!['owner','employee'].includes(membership.role))return NextResponse.json({error:'Nemate pravo slanja zahteva knjigovođi.'},{status:403});

  const admin=createAdminClient();
  try{
    const invite=await createAccountantVerificationInvite({admin,requestUrl:request.url,organizationId:orgId,accountantPib,accountantEmail,createdBy:user.id});
    return NextResponse.json({ok:true,message:`Verifikacioni email je poslat na ${invite.email}. Knjigovođa mora da potvrdi prijem klijenta klikom iz poruke.`,accountant_registered:invite.accountingOrgFound,expires_at:invite.expiresAt});
  }catch(e:any){
    return NextResponse.json({error:e?.message||'Zahtev knjigovođi nije poslat.'},{status:400});
  }
}
