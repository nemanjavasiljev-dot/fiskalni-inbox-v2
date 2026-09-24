import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthorizedAccountantClientIds } from '@/lib/accountant-download-access';

type IntakeType = 'receipts' | 'documents';

function validMonth(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const month = String(value);
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : undefined;
}

function monthBounds(month: string) {
  const [year, mon] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, mon - 1, 1)).toISOString();
  const end = new Date(Date.UTC(year, mon, 1)).toISOString();
  return { start, end };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Niste prijavljeni.' }, { status: 401 });

  let body: any = {};
  try { body = await request.json(); } catch {}
  const type: IntakeType = body?.type === 'documents' ? 'documents' : 'receipts';
  const month = validMonth(body?.month);
  if (month === undefined) return NextResponse.json({ error: 'Neispravan mesec.' }, { status: 400 });

  try {
    const admin = createAdminClient();
    const organizationIds = await getAuthorizedAccountantClientIds(admin, user.id);
    if (!organizationIds.length) {
      return NextResponse.json({ error: 'Nema aktivnih klijenata kojima imate pristup.' }, { status: 403 });
    }

    const isReceipts = type === 'receipts';
    const sourceTable = isReceipts ? 'receipts' : 'documents';
    const itemIdColumn = isReceipts ? 'receipt_id' : 'document_id';
    const statusTable = isReceipts ? 'accountant_receipt_status' : 'accountant_document_status';
    const dateColumn = isReceipts ? 'sent_to_accountant_at' : 'sent_at';

    let query = admin
      .from(sourceTable)
      .select(`id,organization_id,${dateColumn}`)
      .in('organization_id', organizationIds)
      .not(dateColumn, 'is', null)
      .order(dateColumn, { ascending: false })
      .limit(5000);

    if (!isReceipts) query = query.eq('status', 'sent');
    if (month) {
      const { start, end } = monthBounds(month);
      query = query.gte(dateColumn, start).lt(dateColumn, end);
    }

    const { data: items, error: itemError } = await query;
    if (itemError) throw itemError;
    const rows = items || [];
    if (!rows.length) return NextResponse.json({ ok: true, assigned: 0, total: 0, breakdown: [] });

    const { data: existing, error: statusError } = await admin
      .from(statusTable)
      .select(`${itemIdColumn},opened_at`)
      .eq('accountant_user_id', user.id)
      .in('organization_id', organizationIds);
    if (statusError) throw statusError;

    const alreadyOpened = new Set(
      (existing || [])
        .filter((x: any) => x.opened_at)
        .map((x: any) => String(x[itemIdColumn]))
    );
    const pending = rows.filter((row: any) => !alreadyOpened.has(String(row.id)));

    if (pending.length) {
      const now = new Date().toISOString();
      const statusRows = pending.map((row: any) => ({
        accountant_user_id: user.id,
        organization_id: row.organization_id,
        [itemIdColumn]: row.id,
        opened_at: now,
        updated_at: now
      }));
      const { error: upsertError } = await admin
        .from(statusTable)
        .upsert(statusRows, { onConflict: `accountant_user_id,${itemIdColumn}` });
      if (upsertError) throw upsertError;
    }

    const counts = new Map<string, number>();
    for (const row of pending) {
      const id = String(row.organization_id);
      counts.set(id, (counts.get(id) || 0) + 1);
    }

    const { data: orgs } = await admin
      .from('organizations')
      .select('id,name')
      .in('id', [...counts.keys()]);
    const names = new Map((orgs || []).map((o: any) => [String(o.id), String(o.name || 'Klijent')]));
    const breakdown = [...counts.entries()]
      .map(([organization_id, count]) => ({ organization_id, name: names.get(organization_id) || 'Klijent', count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'sr'));

    return NextResponse.json({ ok: true, assigned: pending.length, total: rows.length, breakdown });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Prijem nije mogao da se obradi.' }, { status: 400 });
  }
}
