import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MASTER_USERNAME = "master";
const MASTER_DEFAULT_PASSWORD = "MASTER";
const MASTER_INTERNAL_EMAIL = "master@fiscalbox.local";

async function bootstrapMaster(admin:any) {
  const { data: existingMaster } = await admin
    .from("profiles")
    .select("user_id,auth_email,username")
    .eq("global_role", "master_admin")
    .limit(1)
    .maybeSingle();

  if (existingMaster) return null;

  let { data: bootstrapProfile } = await admin
    .from("profiles")
    .select("user_id,auth_email,username")
    .eq("auth_email", MASTER_INTERNAL_EMAIL)
    .maybeSingle();

  let userId = bootstrapProfile?.user_id as string | undefined;

  if (!userId) {
    const created = await admin.auth.admin.createUser({
      email: MASTER_INTERNAL_EMAIL,
      password: MASTER_DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: "FiscalBox MASTER",
        must_change_master_credentials: true,
      },
    });
    if (created.error || !created.data.user) {
      throw created.error || new Error("Master nalog nije kreiran.");
    }
    userId = created.data.user.id;
  } else {
    const updatedAuth = await admin.auth.admin.updateUserById(userId, {
      password: MASTER_DEFAULT_PASSWORD,
      user_metadata: {
        full_name: "FiscalBox MASTER",
        must_change_master_credentials: true,
      },
    });
    if (updatedAuth.error) throw updatedAuth.error;
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      username: MASTER_USERNAME,
      full_name: "FiscalBox MASTER",
      global_role: "master_admin",
      auth_email: MASTER_INTERNAL_EMAIL,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (profileError) throw profileError;
  return MASTER_INTERNAL_EMAIL;
}

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    const u = String(username || "").trim().toLowerCase();
    const p = String(password || "");
    if (!u || !p) return NextResponse.json({ error:"Unesite korisničko ime/email i lozinku." }, { status:400 });

    let email=u;
    if(!u.includes("@")){
      const admin = createAdminClient();

      if (u === MASTER_USERNAME) {
        const { data: existingMaster } = await admin
          .from("profiles")
          .select("user_id,auth_email,username")
          .eq("global_role", "master_admin")
          .limit(1)
          .maybeSingle();

        if (existingMaster) {
          if (String(existingMaster.username || "").toLowerCase() !== MASTER_USERNAME) {
            return NextResponse.json({ error:"Pogrešno korisničko ime/email ili lozinka." }, { status:401 });
          }
          email = existingMaster.auth_email;
        } else {
          if (p !== MASTER_DEFAULT_PASSWORD) {
            return NextResponse.json({ error:"Pogrešno korisničko ime/email ili lozinka." }, { status:401 });
          }
          email = await bootstrapMaster(admin) || "";
          if (!email) return NextResponse.json({ error:"Master nalog već postoji. Koristite njegove aktuelne kredencijale." }, { status:401 });
        }
      } else {
        const { data: profile } = await admin.from("profiles").select("auth_email").eq("username", u).maybeSingle();
        if (!profile?.auth_email) return NextResponse.json({ error:"Pogrešno korisničko ime/email ili lozinka." }, { status:401 });
        email=profile.auth_email;
      }
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: p });
    if (error) return NextResponse.json({ error:"Pogrešno korisničko ime/email ili lozinka." }, { status:401 });
    return NextResponse.json({ ok:true });
  } catch (error:any) {
    console.error("username-login", error);
    return NextResponse.json({ error:"Prijava trenutno nije dostupna." }, { status:500 });
  }
}
