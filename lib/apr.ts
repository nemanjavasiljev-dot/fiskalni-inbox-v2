// Backward-compatible APR helpers. New code should use APRSyncService + central companies registry.
import { APRSyncService } from '@/lib/apr-sync-service';

export async function aprLookup(query: unknown) {
  const text = String(query || '').trim();
  const company = await APRSyncService.syncExact(text);
  if (!company) throw new Error('Firma nije pronađena u APR-u.');
  return { company, query: text, kind: /^\d{8}$/.test(text) ? 'mb' : /^\d{9}$/.test(text) ? 'pib' : 'name', configured: true };
}
