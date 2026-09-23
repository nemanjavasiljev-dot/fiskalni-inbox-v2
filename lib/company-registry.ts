import { createAdminClient } from '@/lib/supabase/admin';

export type CompanyRecord = {
  id: string;
  name: string;
  normalized_name?: string;
  registration_number: string | null;
  pib: string | null;
  address: string | null;
  city: string | null;
  municipality: string | null;
  postal_code: string | null;
  legal_form: string | null;
  activity_code: string | null;
  activity_name: string | null;
  registry_status: string | null;
  founded_at: string | null;
  apr_source_id: string | null;
  apr_last_sync: string | null;
  apr_raw?: unknown;
  source_status?: string;
  manual_review_required?: boolean;
};

export function sanitizeCompanyQuery(value: unknown) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

export function digitsOnly(value: unknown) {
  return String(value ?? '').replace(/\D/g, '');
}

export function normalizeCompanyName(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9čćžšđ]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function publicCompany(company: any): CompanyRecord {
  return {
    id: String(company.id),
    name: String(company.name || ''),
    registration_number: company.registration_number || null,
    pib: company.pib || null,
    address: company.address || null,
    city: company.city || null,
    municipality: company.municipality || null,
    postal_code: company.postal_code || null,
    legal_form: company.legal_form || null,
    activity_code: company.activity_code || null,
    activity_name: company.activity_name || null,
    registry_status: company.registry_status || null,
    founded_at: company.founded_at || null,
    apr_source_id: company.apr_source_id || null,
    apr_last_sync: company.apr_last_sync || null,
    source_status: company.source_status || undefined,
    manual_review_required: Boolean(company.manual_review_required),
  };
}

export async function searchLocalCompanies(query: string, limit = 15) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('search_companies', {
    search_text: query,
    result_limit: Math.max(1, Math.min(20, limit)),
  });
  if (error) throw error;
  return (data || []).map(publicCompany);
}

export async function getCompanyById(id: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from('companies').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? publicCompany(data) : null;
}

export async function getCompanyByRegistrationNumber(registrationNumber: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from('companies').select('*').eq('registration_number', registrationNumber).maybeSingle();
  if (error) throw error;
  return data ? publicCompany(data) : null;
}

export async function getCompanyByPib(pib: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from('companies').select('*').eq('pib', pib).maybeSingle();
  if (error) throw error;
  return data ? publicCompany(data) : null;
}

export async function checkSearchRateLimit(key: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('check_company_search_rate_limit', {
    p_key: key.slice(0, 180),
    p_limit: 30,
    p_window_seconds: 60,
  });
  if (error) {
    // Search should not fail closed because of an internal rate-limit persistence problem.
    console.error('company-search-rate-limit', error.message);
    return true;
  }
  return data === true;
}
