import { NextResponse } from "next/server";
import { checkSearchRateLimit } from "@/lib/company-registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendRegistrationVerificationEmail } from "@/lib/mailer";

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request:Request){
  const body=await request.json().catch(()=>({}));
  const email=String(body.email||"").trim().toLowerCase();
  if(!EMAIL.test(email))return NextResponse.json({error:"Unesite ispravnu email adresu."},{status:400});
  const ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";
  if(!(await checkSearchRateLimit(`resend-verification:${ip}:${email}`)))return NextResponse.json({error:"Sačekajte minut pre novog pokušaja."},{status:429});
  const admin=createAdminClient();
  const {data:profile}=await admin.from("profiles").select("user_id,username").eq("auth_email",email).maybeSingle();
  // Ne otkrivamo da li email postoji u bazi.
  if(!profile?.user_id)return NextResponse.json({ok:true,message:"Ako nalog postoji, verifikacioni email je poslat."});
  const {data:userData}=await admin.auth.admin.getUserById(profile.user_id);
  if(!userData?.user)return NextResponse.json({ok:true,message:"Ako nalog postoji, verifikacioni email je poslat."});
  if(userData.user.email_confirmed_at)return NextResponse.json({ok:true,message:"Email je već potvrđen. Možete se prijaviti."});
  const origin=new URL(process.env.NEXT_PUBLIC_APP_URL||request.url).origin;
  const generated=await admin.auth.admin.generateLink({type:"magiclink",email,options:{redirectTo:`${origin}/auth/callback?next=${encodeURIComponent('/login?verified=1')}`}});
  if(generated.error)return NextResponse.json({error:"Novi verifikacioni link trenutno nije moguće generisati."},{status:400});
  const actionLink=String((generated.data as any)?.properties?.action_link||"");
  if(!actionLink)return NextResponse.json({error:"Verifikacioni link nije generisan."},{status:400});
  const sent=await sendRegistrationVerificationEmail({to:email,username:profile.username||email,verifyUrl:actionLink,magic:true});
  if(!sent.sent)return NextResponse.json({error:!sent.configured?"Email servis nije podešen.":`Email nije poslat${sent.status?` (HTTP ${sent.status})`:''}.`},{status:503});
  return NextResponse.json({ok:true,message:"Novi verifikacioni email je poslat."});
}
