import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "@/lib/supabase/url";

export function createAdminClient() {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase admin credentials are not configured.");

  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
