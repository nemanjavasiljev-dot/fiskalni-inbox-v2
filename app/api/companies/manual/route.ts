import { normalizePib, isValidPib } from '@/lib/company-identifiers';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkSearchRateLimit, digitsOnly, normalizeCompanyName, publicCompany, sanitizeCompanyQuery } from '@/lib/company-registry';

export const maxDuration = 15;

function clientKey(request: Request) {
  const h = request.headers;
  const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim();
  return `manual-company:${forwarded || h.get('x-real-ip') || 'unknown'}`;
}

function cleanText(value: unknown, max = 180) {
  return sanitizeCompanyQuery(value).slice(0, max) || null;
}

export async function POST(request: Request) {
  if (!(await checkSearchRateLimit(clientKey(request)))) {
    return NextResponse.json({ error: 'Previše pokušaja. Pokušajte ponovo za minut.' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const name = sanitizeCompanyQuery(body.name).slice(0, 220);
  const pib = normalizePib(body.pib);
  const registrationNumber = String(body.registration_number || '').trim();
  const registryKind = ['company', 'entrepreneur', 'other'].includes(String(body.registry_kind))
    ? String(body.registry_kind)
    : 'company';

  if (name.length < 2) return NextResponse.json({ error: 'Unesite pun naziv firme ili preduzetnika.' }, { status: 400 });
  if (pib && !isValidPib(pib)) return NextResponse.json({ error: 'PIB mora imati 9 cifara i ispravnu kontrolnu cifru.' }, { status: 400 });
  if (registrationNumber && !/^\d{8}$/.test(registrationNumber)) return NextResponse.json({ error: 'Matični broj mora imati 8 cifara.' }, { status: 400 });
  if (!pib && !registrationNumber) return NextResponse.json({ error: 'Unesite najmanje PIB ili matični broj.' }, { status: 400 });

  const admin = createAdminClient();

  try {
    let existing: any = null;
    if (pib) {
      const result = await admin.from('companies').select('*').eq('pib', pib).maybeSingle();
      if (result.error) throw result.error;
      existing = result.data;
    }
    if (!existing && registrationNumber) {
      const result = await admin.from('companies').select('*').eq('registration_number', registrationNumber).maybeSingle();
      if (result.error) throw result.error;
      existing = result.data;
    }

    const manualSnapshot = {
      entered_at: new Date().toISOString(),
      entered_name: name,
      entered_pib: pib || null,
      entered_registration_number: registrationNumber || null,
      contact_email: cleanText(body.contact_email, 180),
      contact_phone: cleanText(body.contact_phone, 80),
    };

    if (existing) {
      if ((pib && existing.pib && pib !== existing.pib) || (registrationNumber && existing.registration_number && registrationNumber !== existing.registration_number)) {
        return NextResponse.json({error:'PIB i matični broj pripadaju različitim zapisima. Proverite unos.'},{status:409});
      }
      // Existing shared records may only be edited through an authenticated administrative workflow.

      return NextResponse.json({
        ok: true,
        existing: true,
        company: {
          ...publicCompany(existing),
          contact_email: cleanText(body.contact_email, 180),
          contact_phone: cleanText(body.contact_phone, 80),
        },
        warning: existing.manual_review_required
          ? 'Ručni zapis je sačuvan i označen za naknadnu proveru.'
          : 'Pronađen je postojeći zapis u registru. Koristićemo postojeće zvanične podatke.',
      });
    }

    const payload: Record<string, unknown> = {
      name,
      normalized_name: normalizeCompanyName(name),
      short_name: cleanText(body.short_name),
      pib: pib || null,
      registration_number: registrationNumber || null,
      legal_form: cleanText(body.legal_form),
      registry_status: cleanText(body.registry_status),
      address: cleanText(body.address),
      city: cleanText(body.city),
      municipality: cleanText(body.municipality),
      postal_code: digitsOnly(body.postal_code).slice(0, 5) || null,
      activity_code: digitsOnly(body.activity_code).slice(0, 5) || null,
      activity_name: cleanText(body.activity_name),
      apr_source_id: null,
      apr_last_sync: null,
      source_status: 'manual_review',
      manual_review_required: true,
      registry_source: 'RUČNI UNOS',
      registry_kind: registryKind,
      nbs_raw: { manual_entry: manualSnapshot },
      updated_at: new Date().toISOString(),
    };

    const inserted = await admin.from('companies').insert(payload).select('*').single();
    if (inserted.error) throw inserted.error;

    return NextResponse.json({
      ok: true,
      existing: false,
      company: {
        ...publicCompany(inserted.data),
        contact_email: cleanText(body.contact_email, 180),
        contact_phone: cleanText(body.contact_phone, 80),
      },
      warning: 'Podaci su uneti ručno i označeni za naknadnu proveru registra.',
    });
  } catch (e: any) {
    console.error('manual-company-create', e);
    return NextResponse.json({ error: e?.message || 'Ručni unos firme nije sačuvan.' }, { status: 400 });
  }
}
