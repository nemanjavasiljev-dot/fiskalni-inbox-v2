import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function requireMaster() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Niste prijavljeni." };
  const { data: profile } = await supabase.from("profiles").select("global_role").eq("user_id", user.id).maybeSingle();
  if (profile?.global_role !== "master_admin") return { ok: false as const, status: 403, error: "Master admin pristup je obavezan." };
  return { ok: true as const, user, admin: createAdminClient() };
}
