import { NextResponse } from 'next/server';
import { checkSearchRateLimit } from '@/lib/company-registry';
import { isValidPib, lookupCompanyByPib, normalizePib } from '@/lib/company-registry/company-registry-service';
import { NbsNotConfiguredError, NbsNotFoundError, NbsServiceError } from '@/lib/company-registry/nbs-service';

export const maxDuration = 15;

function clientKey(request: Request) {
  const h = request.headers;
  const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim();
  return `pib-lookup:${forwarded || h.get('x-real-ip') || 'unknown'}`;
}

export async function GET(request: Request) {
  const pib = normalizePib(new URL(request.url).searchParams.get('pib'));

  if (!isValidPib(pib)) {
    return NextResponse.json({ ok: false, code: 'INVALID_PIB', error: 'PIB mora imati tačno 9 cifara.' }, { status: 400 });
  }

  if (!(await checkSearchRateLimit(clientKey(request)))) {
    return NextResponse.json({ ok: false, code: 'RATE_LIMIT', error: 'Previše zahteva. Pokušajte ponovo za minut.' }, { status: 429 });
  }

  try {
    const result = await lookupCompanyByPib(pib);
    return NextResponse.json({
      ok: true,
      company: result.company,
      source: result.source,
      checkedAt: result.checkedAt,
      cached: result.cached,
      warning: result.warning || '',
    });
  } catch (error: any) {
    if (error?.code === 'INVALID_PIB') {
      return NextResponse.json({ ok: false, code: 'INVALID_PIB', error: error.message }, { status: 400 });
    }
    if (error instanceof NbsNotFoundError) {
      return NextResponse.json({ ok: false, code: error.code, fallback: true, error: error.message }, { status: 404 });
    }
    if (error instanceof NbsNotConfiguredError) {
      return NextResponse.json({
        ok: false,
        code: error.code,
        fallback: true,
        error: 'Automatska PIB provera još nije aktivirana. Možete nastaviti pretragom po nazivu ili matičnom broju.',
      }, { status: 503 });
    }
    if (error instanceof NbsServiceError) {
      return NextResponse.json({
        ok: false,
        code: error.code,
        fallback: true,
        error: 'Automatska provera registra trenutno nije dostupna. Možete nastaviti pretragom po nazivu ili matičnom broju.',
      }, { status: 502 });
    }
    console.error('company-lookup', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({
      ok: false,
      code: 'LOOKUP_ERROR',
      fallback: true,
      error: 'Automatska provera registra trenutno nije dostupna. Možete nastaviti ručnom pretragom.',
    }, { status: 500 });
  }
}
