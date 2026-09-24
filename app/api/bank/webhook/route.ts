import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeBankTransaction, storeTransaction, tryAutoMatch } from '@/lib/bank-reconciliation';

function safeSecretEqual(received: string, expected: string) {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const expected = String(process.env.BANK_WEBHOOK_SECRET || '');
  const received = String(request.headers.get('x-fiscalbox-bank-secret') || '');
  if (!expected || !received || !safeSecretEqual(received, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const length = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(length) && length > 1_000_000) {
    return NextResponse.json({ error: 'Payload je prevelik.' }, { status: 413 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  const admin = createAdminClient();
  const rows = Array.isArray(body) ? body : Array.isArray(body.transactions) ? body.transactions : [body];
  if (rows.length > 500) return NextResponse.json({ error: 'Previše transakcija u jednom zahtevu.' }, { status: 413 });

  let accepted = 0;
  let matched = 0;
  for (const raw of rows) {
    const tx = normalizeBankTransaction(raw, process.env.BANK_PROVIDER || 'bank_webhook');
    if (!tx || tx.direction !== 'credit') continue;
    const saved = await storeTransaction(admin, tx);
    accepted++;
    const result = await tryAutoMatch(admin, saved, null, `${new URL(request.url).origin}/app/billing`);
    if (result.matched) matched++;
  }
  return NextResponse.json({ ok: true, accepted, matched });
}
