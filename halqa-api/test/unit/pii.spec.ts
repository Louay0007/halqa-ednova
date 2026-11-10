import { containsPii, screenPii } from '../../src/domain/pii';

describe('pii screen', () => {
  it('detects and redacts email', () => {
    const { clean, findings } = screenPii('mail me at rim@example.com please');
    expect(findings).toContain('email');
    expect(clean).not.toContain('rim@example.com');
  });
  it('detects and redacts phone', () => {
    const { clean, findings } = screenPii('call +216 12 345 678 now');
    expect(findings).toContain('phone');
    expect(clean).not.toContain('216');
  });
  it('passes clean text through untouched', () => {
    const { clean, findings } = screenPii('شنو الشرط اللي لازم قبل ما نقسمو؟');
    expect(findings).toEqual([]);
    expect(clean).toContain('نقسمو');
  });
  it('containsPii is consistent with screenPii', () => {
    expect(containsPii('a@b.co')).toBe(true);
    expect(containsPii('binary search halves a sorted array')).toBe(false);
  });
});
