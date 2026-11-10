import { createHash } from 'crypto';

// Semantic cache key — PURE, zero Nest imports.
// key = sha1(normalise(intent) + level + lang + sorted(chunkIds) + ladderState)
// Equivalent re-asks collapse to one key, so they are served without a model call.

const FILLERS = /\b(a|an|the|of|to|in|on|for|with|by|about|est|une|un|des|les|le|la|de|et|ou)\b/g;

/** Normalise free text so equivalent re-asks share a key. */
export function normaliseIntent(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics (é→e, works for FR/AR harakat-adjacent marks)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .replace(FILLERS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface CacheKeyInput {
  intent: string;
  level: string;
  lang: string;
  chunkIds: string[];
  ladderState?: number;
}

export function buildCacheKey(input: CacheKeyInput): string {
  const norm = normaliseIntent(input.intent);
  const sorted = [...input.chunkIds].sort();
  const raw = [norm, input.level, input.lang, sorted.join(','), String(input.ladderState ?? 0)].join('|');
  return createHash('sha1').update(raw).digest('hex');
}
