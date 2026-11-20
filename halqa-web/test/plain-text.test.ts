import { describe, expect, it } from 'vitest';
import { plainText } from '../src/lib/plain-text';

/**
 * The prose under a Nova answer is model output rendered into a `<p>`. Two
 * things shipped to learners verbatim and are pinned here: the markdown it
 * emits, and the chunk ids it writes into the sentence when asked to ground
 * itself (`… [bs-en-01].`), which the chip row below already cites.
 */
describe('plainText', () => {
  it('drops a bracketed chunk id and keeps the full stop after it', () => {
    // Live deep dive: `… كيضمن أن كل عنصر فاليسار أصغر [bs-en-01].`
    expect(plainText('التعقيد O(log n) [bs-en-01].')).toBe('التعقيد O(log n).');
  });

  it('drops a parenthesised group of ids', () => {
    // Live quick take: `… El qarar kaykhessu l-liste tkoun mrattba (bs-en-01, bs-fr-01).`
    expect(plainText('mrattba (bs-en-01, bs-fr-01).')).toBe('mrattba.');
    // Darija writes its list separator as the Arabic comma.
    expect(plainText('mrattba (bs-en-01، bs-fr-01) واخا.')).toBe('mrattba واخا.');
  });

  it('drops an id the model wired in with an arrow', () => {
    // Live deep dive, the arrow form — the third shape after `[…]` and `(…)`.
    expect(plainText('هاد الشرط → bs-en-01 ضروري.')).toBe('هاد الشرط ضروري.');
    expect(plainText('المقارنة bs-fr-01 → bs-en-03 → كتبدأ.')).toBe('المقارنة كتبدأ.');
    expect(plainText('الخطوة التانية -> bs-en-03 ثم').replace(/\s+/g, ' ')).toBe('الخطوة التانية ثم');
  });

  it('drops a bare id left with no bracket or arrow', () => {
    expect(plainText('كيستعمل bs-en-01 هنا')).toBe('كيستعمل هنا');
  });

  it('keeps a hyphenated term that only looks like an id', () => {
    // One hyphen is not the id shape; `O(n log n)` and `base-2` are the content.
    expect(plainText('اكتب base-2 في الجواب')).toBe('اكتب base-2 في الجواب');
  });

  it('drops a horizontal rule the model writes as a separator', () => {
    expect(plainText('جواب\n---\nزيد')).toBe('جواب\nزيد');
  });

  it('keeps a bracket that is not a citation', () => {
    // The example chunks are full of these, and they are the content.
    expect(plainText('7 في [1,3,5,7,9] هو 7')).toBe('7 في [1,3,5,7,9] هو 7');
    expect(plainText('O(log n) comparisons')).toBe('O(log n) comparisons');
    expect(plainText('see (chapter 2)')).toBe('see (chapter 2)');
  });

  it('keeps hyphenated words that are not chunk ids', () => {
    // `deep-dive` has the slug shape but no trailing number.
    expect(plainText('a deep-dive [deep-dive] into it')).toBe('a deep-dive [deep-dive] into it');
  });

  it('still strips the markdown it always stripped', () => {
    expect(plainText('**Bold** and `code`')).toBe('Bold and code');
    expect(plainText('## Heading\n1. first\n- second')).toBe('Heading\nfirst\nsecond');
  });

  it('returns an empty string for missing text', () => {
    expect(plainText(undefined)).toBe('');
    expect(plainText(null)).toBe('');
  });
});
