import QRCode from 'qrcode';

function cleanText(value: unknown, max = 70) {
  return String(value ?? '')
    .replace(/[|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function normalizeSerbianBankAccount(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const dashed = raw.split('-').map(x => x.replace(/\D/g, '')).filter(Boolean);
  if (dashed.length >= 3) {
    const bank = dashed[0].padStart(3, '0').slice(-3);
    const control = dashed[dashed.length - 1].padStart(2, '0').slice(-2);
    const middle = dashed.slice(1, -1).join('').padStart(13, '0').slice(-13);
    return `${bank}${middle}${control}`;
  }
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 18) return digits;
  if (digits.length >= 5 && digits.length < 18) {
    const bank = digits.slice(0, 3);
    const control = digits.slice(-2);
    const middle = digits.slice(3, -2).padStart(13, '0');
    return `${bank}${middle}${control}`;
  }
  return digits;
}

export function paymentReferenceFromDocumentNumber(documentNumber: string) {
  const digits = String(documentNumber || '').replace(/\D/g, '');
  // Model 00 + numeric reference. NBS RO field max is 25 chars including model.
  return `00${digits}`.slice(0, 25);
}

export function buildIpsPaymentString(opts: {
  bankAccount: string;
  payeeName: string;
  amount: number;
  paymentCode?: string;
  purpose: string;
  paymentReference?: string | null;
}) {
  const account = normalizeSerbianBankAccount(opts.bankAccount);
  if (!/^\d{18}$/.test(account)) throw new Error('Broj računa izdavaoca mora biti ispravan dinarski račun od 18 cifara.');
  const amount = Number(opts.amount || 0);
  if (!(amount > 0)) throw new Error('Iznos za IPS QR mora biti veći od nule.');
  const amountText = amount.toFixed(2).replace('.', ',');
  const paymentCode = String(opts.paymentCode || '221').replace(/\D/g, '').slice(0, 3) || '221';
  const parts = [
    'K:PR',
    'V:01',
    'C:1',
    `R:${account}`,
    `N:${cleanText(opts.payeeName, 70)}`,
    `I:RSD${amountText}`,
    `SF:${paymentCode}`,
    `S:${cleanText(opts.purpose, 35)}`
  ];
  if (opts.paymentReference) parts.push(`RO:${cleanText(opts.paymentReference, 25)}`);
  return parts.join('|');
}

export function qrMatrixFromText(text: string) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  const data = qr.modules.data as Uint8Array | boolean[];
  return {
    size,
    isDark(row: number, col: number) {
      return Boolean((data as any)[row * size + col]);
    }
  };
}

export async function validateIpsTextWithNbs(text: string) {
  try {
    const response = await fetch('https://nbs.rs/QRcode/api/qr/v1/generate/300?lang=sr_RS_Latn', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain; charset=utf-8', Accept: 'application/json' },
      body: text,
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return { checked: true, valid: false, status: response.status, errors: [`HTTP ${response.status}`] };
    const json: any = await response.json().catch(() => null);
    const code = Number(json?.s?.code ?? 0);
    const valid = Boolean(json?.i) || code === 0 || code === 200;
    return { checked: true, valid, status: response.status, errors: Array.isArray(json?.e) ? json.e : [], response: json };
  } catch (error: any) {
    return { checked: false, valid: null, errors: [error?.message || 'NBS validator trenutno nije dostupan.'] };
  }
}
