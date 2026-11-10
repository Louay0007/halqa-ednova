// Log scrubber — redacts secrets + PII before anything reaches a log,
// screenshot, video, or report. Wrap every log line through scrubLine().
const ISO_TS = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/g;
const SECRET_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /(sk-[A-Za-z0-9-_]{4})[A-Za-z0-9-_]{8,}/g, label: '$1[REDACTED]' },
  { re: /(bearer\s+)[A-Za-z0-9\-._~+/=]{8,}/gi, label: '$1[REDACTED]' },
  { re: /(api[_-]?key["'\s:=]+)([A-Za-z0-9\-_]{6,})/gi, label: '$1[REDACTED]' },
  { re: /(token["'\s:=]+)(eyJ[A-Za-z0-9\-_.]{8,}|[A-Za-z0-9\-_]{16,})/gi, label: '$1[REDACTED]' },
  { re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, label: '[EMAIL_REDACTED]' },
  // phone: digit runs with separators, but NOT ISO timestamps (shelved first)
  // and NOT short numeric fragments (port numbers, years, counters).
  { re: /\+?\d[\d\s\-().]{9,}\d/g, label: '[PHONE_REDACTED]' },
];

export function scrubLine(input: unknown): string {
  let s: string;
  try {
    s = typeof input === 'string' ? input : JSON.stringify(input);
  } catch {
    return '[UNLOGGABLE]';
  }
  const shelved: string[] = [];
  s = s.replace(ISO_TS, (m) => {
    shelved.push(m);
    return `\u0000TS${shelved.length - 1}\u0000`;
  });
  for (const { re, label } of SECRET_PATTERNS) s = s.replace(re, label);
  s = s.replace(/\u0000TS(\d+)\u0000/g, (_, i) => shelved[Number(i)]);
  return s;
}
