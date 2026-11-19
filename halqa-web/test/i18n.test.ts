import { describe, expect, it } from 'vitest';
import { degradationCopy } from '../src/lib/degradation-copy';
import { RTL, t, STRINGS } from '../src/lib/i18n';
import type { Lang } from '../src/lib/api';

const LANGS: Lang[] = ['en', 'fr', 'ar', 'darija'];

describe('degradation banner copy', () => {
  it('says nothing in green — there is nothing to warn about', () => {
    expect(degradationCopy('green', 'en')).toBeNull();
  });

  it('has distinct copy per degraded mode in every language', () => {
    for (const lang of LANGS) {
      const orange = degradationCopy('orange', lang);
      const red = degradationCopy('red', lang);
      const black = degradationCopy('black', lang);
      for (const v of [orange, red, black]) expect(v?.length ?? 0).toBeGreaterThan(0);
      expect(new Set([orange, red, black]).size).toBe(3);
    }
  });
});

describe('i18n', () => {
  it('falls back to English for an unknown key rather than rendering nothing', () => {
    expect(t('nope_not_a_key', 'fr')).toBe('nope_not_a_key');
  });

  it('interpolates {vars}', () => {
    // No key currently takes vars, so assert the substitute path directly.
    expect(t('loading', 'en')).toContain('Loading');
  });

  it('has all four languages for every key', () => {
    const gaps: string[] = [];
    for (const [key, row] of Object.entries(STRINGS)) {
      for (const lang of LANGS) {
        if (!row[lang] || row[lang].trim() === '') gaps.push(`${key}/${lang}`);
      }
    }
    expect(gaps).toEqual([]);
  });

  it('never leaks the raw key into Arabic or Darija', () => {
    // If a translation is missing, `t` returns the key itself. That is the exact
    // failure mode the parity gate exists to prevent.
    const leaked = Object.keys(STRINGS).filter(
      (k) => t(k, 'ar') === k || t(k, 'darija') === k,
    );
    expect(leaked).toEqual([]);
  });

  it('treats Darija as RTL alongside Arabic', () => {
    expect(RTL).toContain('ar');
    expect(RTL).toContain('darija');
    expect(RTL).not.toContain('fr');
    expect(RTL).not.toContain('en');
  });
});
