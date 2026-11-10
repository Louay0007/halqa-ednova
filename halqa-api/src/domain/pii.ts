// PII screen — runs BEFORE any model call and at every text write boundary.
// Pure function: no Nest imports (unit-testable without DI).
export type PiiKind = 'email' | 'phone' | 'address_hint' | 'id_digits' | 'handle_phone';

export interface PiiFinding {
  kind: PiiKind;
  redacted: string;
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /(\+?\d[\d\s\-.()]{7,}\d)/g;
const LONG_DIGITS = /\b\d{8,}\b/g;
const ADDR_HINT =
  /\b(\d{1,5}\s+(rue|avenue|شارع|نهج|زنقة)\b|\b\d{5}\b\s+[A-Z\u0600-\u06FF][\w\u0600-\u06FF-]+)/gi;

export function screenPii(text: string): { clean: string; findings: PiiKind[] } {
  let clean = text;
  const findings: PiiKind[] = [];
  if (EMAIL.test(text)) findings.push('email');
  EMAIL.lastIndex = 0;
  clean = clean.replace(EMAIL, '[email]');
  if (PHONE.test(clean)) findings.push('phone');
  PHONE.lastIndex = 0;
  clean = clean.replace(PHONE, '[phone]');
  if (ADDR_HINT.test(clean)) findings.push('address_hint');
  ADDR_HINT.lastIndex = 0;
  clean = clean.replace(ADDR_HINT, '[address]');
  if (LONG_DIGITS.test(clean)) findings.push('id_digits');
  LONG_DIGITS.lastIndex = 0;
  clean = clean.replace(LONG_DIGITS, '[id]');
  return { clean, findings };
}

export function containsPii(text: string): boolean {
  return screenPii(text).findings.length > 0;
}
