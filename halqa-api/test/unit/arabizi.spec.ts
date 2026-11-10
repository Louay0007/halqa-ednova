import { detectRegister, looksLikeDarija, normaliseArabizi } from '../../src/domain/arabizi';

describe('arabizi (pure)', () => {
  it('maps digits and digraphs to Arabic script', () => {
    expect(normaliseArabizi('3lech')).toContain('ع');
    expect(normaliseArabizi('7al')).toContain('ح');
    expect(normaliseArabizi('5ir')).toContain('خ');
    expect(normaliseArabizi('chouf')).toContain('ش');
    expect(normaliseArabizi('ghriba')).toContain('غ');
  });
  it('detects Darija cues in Arabizi and Arabic script', () => {
    expect(looksLikeDarija('3lech ma nejemch')).toBe(true);
    expect(looksLikeDarija('شنو الشرط باش نقسمو')).toBe(true);
    expect(looksLikeDarija('binary search halves a sorted array')).toBe(false);
  });
  it('detectRegister routes arabizi → darija handling', () => {
    expect(detectRegister('3lech ma nejemch')).toBe('arabizi');
    expect(detectRegister('شنو الشرط')).toBe('darija');
    expect(detectRegister('البحث الثنائي')).toBe('ar');
    expect(detectRegister('la recherche dichotomique')).toBe('fr');
    expect(detectRegister('binary search halves arrays')).toBe('en');
  });
  it('is idempotent on Arabic input without digits', () => {
    const ar = 'البحث الثنائي يقسم مصفوفة مرتبة';
    expect(normaliseArabizi(ar)).toBe(ar);
  });
});
