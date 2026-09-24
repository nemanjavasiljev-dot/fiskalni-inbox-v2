export function safeRedirectPath(value: string | null, origin: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return '/app';
  try {
    const url = new URL(value, origin);
    return url.origin === origin ? url.pathname + url.search + url.hash : '/app';
  } catch { return '/app'; }
}
