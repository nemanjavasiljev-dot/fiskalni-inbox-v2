export function normalizeSupabaseUrl(value: string | undefined) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    // Supabase clients require the project base URL only. Strip accidental
    // REST/RPC/auth paths copied from dashboards or logs.
    return `${url.protocol}//${url.host}`;
  } catch {
    return raw.replace(/\/(rest\/v1|rpc|auth\/v1|storage\/v1).*$/i, '').replace(/\/+$/, '');
  }
}
