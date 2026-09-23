import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireMaster } from "@/lib/master-auth";
import { normalizeSupabaseUrl } from "@/lib/supabase/url";

const USERNAME_RE = /^[a-z0-9._-]{3,40}$/;

export async function POST(request: Request) {
  try {
    const guard = await requireMaster();
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

    const body = await request.json();
    const currentPassword = String(body.current_password || "");
    const nextUsername = String(body.username || "").trim().toLowerCase();
    const nextPassword = String(body.new_password || "");

    if (!currentPassword) return NextResponse.json({ error:"Unesite trenutnu lozinku." }, { status:400 });
    if (!USERNAME_RE.test(nextUsername)) return NextResponse.json({ error:"Korisničko ime mora imati 3–40 znakova i može sadržati slova, brojeve, tačku, crticu i donju crtu." }, { status:400 });
    if (nextPassword && nextPassword.length < 6) return NextResponse.json({ error:"Nova lozinka mora imati najmanje 6 znakova." }, { status:400 });

    const { data: profile, error: profileReadError } = await guard.admin
      .from("profiles")
      .select("user_id,username,auth_email")
      .eq("user_id", guard.user.id)
      .single();
    if (profileReadError || !profile) return NextResponse.json({ error:"Master profil nije pronađen." }, { status:404 });

    const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !publicKey) return NextResponse.json({ error:"Supabase javna konfiguracija nije podešena." }, { status:500 });

    const verifier = createSupabaseClient(url, publicKey, {
      auth: { persistSession:false, autoRefreshToken:false },
    });
    const { error: verifyError } = await verifier.auth.signInWithPassword({
      email: profile.auth_email,
      password: currentPassword,
    });
    if (verifyError) return NextResponse.json({ error:"Trenutna lozinka nije ispravna." }, { status:401 });

    if (nextUsername !== String(profile.username || "").toLowerCase()) {
      const { data: collision } = await guard.admin
        .from("profiles")
        .select("user_id")
        .eq("username", nextUsername)
        .neq("user_id", guard.user.id)
        .maybeSingle();
      if (collision) return NextResponse.json({ error:"To korisničko ime je već zauzeto." }, { status:409 });
    }

    if (nextPassword) {
      const { error: authUpdateError } = await guard.admin.auth.admin.updateUserById(guard.user.id, {
        password: nextPassword,
        user_metadata: {
          ...(guard.user.user_metadata || {}),
          must_change_master_credentials: false,
        },
      });
      if (authUpdateError) throw authUpdateError;
    }

    const { error: profileUpdateError } = await guard.admin
      .from("profiles")
      .update({ username: nextUsername, updated_at: new Date().toISOString() })
      .eq("user_id", guard.user.id);
    if (profileUpdateError) throw profileUpdateError;

    return NextResponse.json({
      ok:true,
      username:nextUsername,
      message: nextPassword ? "Superadmin korisničko ime i lozinka su sačuvani." : "Superadmin korisničko ime je sačuvano.",
    });
  } catch (error:any) {
    console.error("master-credentials", error);
    return NextResponse.json({ error:"Superadmin kredencijali trenutno ne mogu da se izmene." }, { status:500 });
  }
}
