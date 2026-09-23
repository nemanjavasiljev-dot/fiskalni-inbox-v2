import { createBrowserClient } from "@supabase/ssr";
import { normalizeSupabaseUrl } from "@/lib/supabase/url";

export function createClient() {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase public credentials are not configured.");
  return createBrowserClient(url, key);
}
