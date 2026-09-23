import { NextResponse } from 'next/server';
import {
  checkSearchRateLimit,
  digitsOnly,
  sanitizeCompanyQuery,
  searchLocalCompanies,
} from '@/lib/company-registry';

export const maxDuration = 15;

function clientKey(request: Request) {
  const h = request.headers;
  const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim();
  return `companies:${forwarded || h.get('x-real-ip') || 'unknown'}`;
}

export async function GET(request: Request) {
  const q = sanitizeCompanyQuery(new URL(request.url).searchParams.get('q'));
  const digits = digitsOnly(q);

  if (q.length < 2) {
    return NextResponse.json({
      results: [],
      warning: 'Unesite najmanje 2 karaktera naziva ili početak matičnog broja.',
    });
  }

  if (!(await checkSearchRateLimit(clientKey(request)))) {
    return NextResponse.json(
      { error: 'Previše zahteva. Pokušajte ponovo za minut.' },
      { status: 429 },
    );
  }

  try {
    const results = await searchLocalCompanies(q, 15);
    let warning = '';

    if (!results.length) {
      warning = digits.length
        ? 'Firma nije pronađena po matičnom broju. Proverite broj ili pokušajte naziv firme.'
        : 'Firma nije pronađena. Proverite naziv ili pokušajte matični broj.';
    }

    return NextResponse.json({
      results,
      apr_configured: true,
      apr_source: 'open-data-bulk',
      warning,
    });
  } catch (e) {
    console.error('companies-search', e);
    return NextResponse.json(
      { error: 'Pretraga firmi trenutno nije dostupna. Proverite Supabase konekciju i SQL migracije.' },
      { status: 500 },
    );
  }
}
