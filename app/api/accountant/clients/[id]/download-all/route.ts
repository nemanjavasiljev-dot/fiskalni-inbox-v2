import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildAccountantArchive } from '@/lib/accountant-download';
import { getAuthorizedAccountantClientIds } from '@/lib/accountant-download-access';

function validMonth(value: string | null) {
  if (!value) return null;
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : null;
}
function validYear(value: string | null) {
  if (!value) return null;
  return /^(19|20)\d{2}$/.test(value) ? value : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Niste prijavljeni.' }, { status: 401 });

  const { id } = await params;
  const url = new URL(request.url);
  const type = url.searchParams.get('type') === 'documents' ? 'documents' : 'receipts';
  const year = validYear(url.searchParams.get('year'));
  const month = year ? null : (validMonth(url.searchParams.get('month')) || new Date().toISOString().slice(0, 7));
  if (!year && !month) return NextResponse.json({ error: 'Neispravan obračunski period.' }, { status: 400 });

  try {
    const admin = createAdminClient();
    const ids = await getAuthorizedAccountantClientIds(admin, user.id, id);
    if (!ids.length) return NextResponse.json({ error: 'Nemate aktivan pristup ovom klijentu.' }, { status: 403 });
    const { content, count } = await buildAccountantArchive({
      admin,
      accountantUserId: user.id,
      organizationIds: ids,
      type,
      month: month || undefined,
      year: year || undefined
    });
    const label = type === 'receipts' ? 'racuni' : 'dokumenti';
    const period = year || month;
    return new Response(new Uint8Array(content), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="FiscalBox_${label}_${period}.zip"`,
        'X-FiscalBox-Count': String(count),
        'Cache-Control': 'private, no-store'
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Arhiva nije mogla da se pripremi.' }, { status: 400 });
  }
}
