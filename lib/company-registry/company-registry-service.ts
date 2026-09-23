import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeCompanyName, publicCompany, type CompanyRecord } from '@/lib/company-registry';
import {
  isNbsConfigured,
  lookupNbsCompanyByPib,
  NbsNotConfiguredError,
  NbsNotFoundError,
  NbsServiceError,
} from '@/lib/company-registry/nbs-service';

export type LookupResult = {
  company: CompanyRecord;
  source: 'CACHE' | 'NBS' | 'NBS+APR';
  checkedAt: string | null;
  cached: boolean;
  warning?: string;
};

export function normalizePib(value: unknown) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 9);
}

export function isValidPib(value: unknown) {
  return /^\d{9}$/.test(normalizePib(value));
}

function freshEnough(value: string | null | undefined) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return false;
  const ttlMs = Math.max(60_000, Number(process.env.COMPANY_REGISTRY_CACHE_MS || 86_400_000));
  return Date.now() - timestamp < ttlMs;
}

async function cachedByPib(pib: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from('companies').select('*').eq('pib', pib).maybeSingle();
  if (error) throw error;
  return data || null;
}

function nonEmpty<T>(value: T | null | undefined, fallback: T | null | undefined) {
  if (value === null || value === undefined || value === '') return fallback ?? null;
  return value;
}


function inferRegistryKind(existing: any, legalForm: string | null, name: string | null) {
  if (existing?.registry_kind === 'entrepreneur') return 'entrepreneur';
  const text = `${legalForm || ''} ${name || ''}`.toLowerCase();
  return /(preduzet|preduzetnik|entrepreneur|\bpr\b)/i.test(text) ? 'entrepreneur' : 'company';
}

export async function lookupCompanyByPib(pibInput: unknown): Promise<LookupResult> {
  const pib = normalizePib(pibInput);
  if (!isValidPib(pib)) throw Object.assign(new Error('PIB mora imati tačno 9 cifara.'), { code: 'INVALID_PIB' });

  const admin = createAdminClient();
  const cached = await cachedByPib(pib);
  if (cached && freshEnough(cached.registry_checked_at || cached.nbs_last_check)) {
    return {
      company: publicCompany(cached),
      source: 'CACHE',
      checkedAt: cached.registry_checked_at || cached.nbs_last_check || null,
      cached: true,
    };
  }

  if (!isNbsConfigured()) {
    if (cached) {
      return {
        company: publicCompany(cached),
        source: 'CACHE',
        checkedAt: cached.registry_checked_at || cached.nbs_last_check || null,
        cached: true,
        warning: 'NBS provera trenutno nije konfigurisana; prikazani su poslednji sačuvani podaci.',
      };
    }
    throw new NbsNotConfiguredError();
  }

  try {
    const nbs = await lookupNbsCompanyByPib(pib);
    let existing: any = cached;

    if (!existing && nbs.registrationNumber) {
      const { data, error } = await admin
        .from('companies')
        .select('*')
        .eq('registration_number', nbs.registrationNumber)
        .maybeSingle();
      if (error) throw error;
      existing = data || null;
    }

    const now = new Date().toISOString();
    const matchedApr = Boolean(existing?.apr_source_id || existing?.apr_last_sync);
    const payload: any = {
      pib,
      name: nonEmpty(existing?.name, nbs.name) || nbs.name || `PIB ${pib}`,
      normalized_name: normalizeCompanyName(nonEmpty(existing?.name, nbs.name) || nbs.name || `PIB ${pib}`),
      registration_number: nonEmpty(existing?.registration_number, nbs.registrationNumber),
      short_name: nonEmpty(existing?.short_name, nbs.shortName),
      legal_form: nonEmpty(existing?.legal_form, nbs.legalForm),
      registry_status: nonEmpty(existing?.registry_status, nbs.status),
      address: nonEmpty(existing?.address, nbs.address),
      city: nonEmpty(existing?.city, nbs.city),
      municipality: nonEmpty(existing?.municipality, nbs.municipality),
      postal_code: nonEmpty(existing?.postal_code, nbs.postalCode),
      activity_code: nonEmpty(existing?.activity_code, nbs.activityCode),
      activity_name: nonEmpty(existing?.activity_name, nbs.activityName),
      nbs_raw: nbs.raw,
      nbs_last_check: now,
      registry_checked_at: now,
      registry_source: matchedApr ? 'NBS+APR' : 'NBS',
      source_status: matchedApr ? 'nbs_apr' : 'nbs',
      registry_kind: inferRegistryKind(existing, nbs.legalForm, nbs.name),
      manual_review_required: false,
      updated_at: now,
    };

    let saved: any;
    if (existing?.id) {
      const { data, error } = await admin.from('companies').update(payload).eq('id', existing.id).select('*').single();
      if (error) throw error;
      saved = data;
    } else {
      const { data, error } = await admin.from('companies').insert(payload).select('*').single();
      if (error) throw error;
      saved = data;
    }

    return {
      company: publicCompany(saved),
      source: matchedApr ? 'NBS+APR' : 'NBS',
      checkedAt: now,
      cached: false,
    };
  } catch (error) {
    if (cached && (error instanceof NbsServiceError)) {
      return {
        company: publicCompany(cached),
        source: 'CACHE',
        checkedAt: cached.registry_checked_at || cached.nbs_last_check || null,
        cached: true,
        warning: 'Zvanični registar trenutno nije dostupan; prikazani su poslednji sačuvani podaci.',
      };
    }
    if (error instanceof NbsNotFoundError || error instanceof NbsNotConfiguredError || error instanceof NbsServiceError) throw error;
    throw error;
  }
}
