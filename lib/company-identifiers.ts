/** Preserve invalid input so validation cannot silently select a different company. */
export function normalizePib(value: unknown) {
  return String(value ?? '').trim().replace(/\s/g, '');
}
export function isValidPib(value: unknown) {
  const pib = normalizePib(value);
  if (!/^[1-9]\d{8}$/.test(pib)) return false;
  let product = 10;
  for (const digit of pib.slice(0, 8)) {
    let sum = (Number(digit) + product) % 10;
    if (sum === 0) sum = 10;
    product = (sum * 2) % 11;
  }
  return (11 - product) % 10 === Number(pib[8]);
}
