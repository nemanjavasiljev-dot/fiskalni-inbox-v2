import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    const u = String(username || "").trim().toLowerCase();
    const p = String(password || "");
    if (!u || !p) return NextResponse.json({ error:"Unesite korisničko ime/email i lozinku." }, { status:400 });

    let email=u;
    if(!u.includes("@")){
      const admin = createAdminClient();
      const { data: profile } = await admin.from("profiles").select("auth_email").eq("username", u).maybeSingle();
      if (!profile?.auth_email) return NextResponse.json({ error:"Pogrešno korisničko ime/email ili lozinka." }, { status:401 });
      email=profile.auth_email;
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: p });
    if (error) return NextResponse.json({ error:"Pogrešno korisničko ime/email ili lozinka." }, { status:401 });
    return NextResponse.json({ ok:true });
  } catch {
    return NextResponse.json({ error:"Prijava trenutno nije dostupna." }, { status:500 });
  }
}
