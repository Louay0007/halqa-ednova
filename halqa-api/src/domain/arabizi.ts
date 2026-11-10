// Arabizi → Arabic normaliser + Darija cue detector — PURE, zero Nest imports.
// Blueprint §2.8: ch→ش, gh→غ, 7→ح, 3→ع, 5→خ, dh→ذ, th→ث, ou→و, y→ي

/** Ordered longest-first so digraphs win over single letters. */
const ARABIZI_TABLE: Array<[RegExp, string]> = [
  [/dh/gi, 'ذ'],
  [/th/gi, 'ث'],
  [/ch/gi, 'ش'],
  [/gh/gi, 'غ'],
  [/ou/gi, 'و'],
  [/ch/gi, 'ش'],
  [/7/g, 'ح'],
  [/3/g, 'ع'],
  [/5/g, 'خ'],
  [/(?<![a-z])y(?![a-z])/gi, 'ي'],
];

const DARIJA_CUES = ['3lech', 'kifeh', 'bech', 'chnia', 'chnou', 'barcha', 'mouch', 'chouf', 'kifech', 'win', 'wa9tech'];

const ARABIC_BLOCK = /[\u0600-\u06FF]/;

/** Convert Arabizi latin/digit mix to Arabic script. Idempotent on Arabic input. */
export function normaliseArabizi(text: string): string {
  if (ARABIC_BLOCK.test(text) && !/[0-9]/.test(text)) return text;
  let out = text;
  for (const [re, ar] of ARABIZI_TABLE) out = out.replace(re, ar);
  return out;
}

/** True when the text looks like Darija (Arabizi cues or Arabic + cues). */
export function looksLikeDarija(text: string): boolean {
  const lower = text.toLowerCase();
  if (DARIJA_CUES.some((cue) => lower.includes(cue))) return true;
  // Arabic-script Tunisian markers
  if (/(باش|شنو|شني|برشا|موش|كيفاش|وين|علاش)/.test(text)) return true;
  return false;
}

const FR_WORDS = [' le ', ' la ', ' les ', ' des ', ' une ', ' est ', ' sont ', 'recherche', 'tableau', 'avec', 'pour', 'dans', 'comment', 'pourquoi'];

/** Detect the register: arabizi input maps to Darija handling downstream. */
export function detectRegister(text: string): 'ar' | 'darija' | 'arabizi' | 'fr' | 'en' | 'unknown' {
  if (looksLikeDarija(text)) return ARABIC_BLOCK.test(text) ? 'darija' : 'arabizi';
  if (ARABIC_BLOCK.test(text)) return 'ar';
  if (/[àâçéèêëîïôûù]/i.test(text)) return 'fr';
  const padded = ` ${text.toLowerCase()} `;
  if (FR_WORDS.some((w) => padded.includes(w))) return 'fr';
  if (/[a-z]/i.test(text)) return 'en';
  return 'unknown';
}
