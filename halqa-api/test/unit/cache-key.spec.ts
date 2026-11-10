import { buildCacheKey, normaliseIntent } from '../../src/domain/cache-key';

describe('cache-key (pure)', () => {
  const base = { intent: 'Why does binary search need a sorted array?', level: 'intro', lang: 'en', chunkIds: ['bs-en-01', 'bs-fr-01'] };

  it('is deterministic', () => {
    expect(buildCacheKey(base)).toBe(buildCacheKey(base));
    expect(buildCacheKey(base)).toMatch(/^[0-9a-f]{40}$/);
  });
  it('is invariant to chunk-id order', () => {
    const reordered = { ...base, chunkIds: ['bs-fr-01', 'bs-en-01'] };
    expect(buildCacheKey(reordered)).toBe(buildCacheKey(base));
  });
  it('collapses equivalent re-asks (case/punctuation/whitespace)', () => {
    const variants = [
      'why does binary search need a sorted array',
      '  WHY does binary search need a sorted array???  ',
      'Why does binary search need a sorted array!',
    ];
    const keys = new Set(variants.map((intent) => buildCacheKey({ ...base, intent })));
    expect(keys.size).toBe(1);
  });
  it('is sensitive to level, lang, ladderState, chunks', () => {
    expect(buildCacheKey({ ...base, level: 'advanced' })).not.toBe(buildCacheKey(base));
    expect(buildCacheKey({ ...base, lang: 'fr' })).not.toBe(buildCacheKey(base));
    expect(buildCacheKey({ ...base, ladderState: 2 })).not.toBe(buildCacheKey(base));
    expect(buildCacheKey({ ...base, chunkIds: ['bs-en-01'] })).not.toBe(buildCacheKey(base));
  });
  it('normalise strips diacritics + fillers', () => {
    expect(normaliseIntent('La recherche dichotomique')).toBe('la recherche dichotomique'.replace(/\b(la)\b/g, '').replace(/\s+/g, ' ').trim());
    expect(normaliseIntent('École')).toBe('ecole');
  });
});
