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

  // §3.10: a nickname is user-typed text at a write boundary, and it is shown to
  // the whole circle — an email typed into it is published, not merely stored.
  it('redacts a nickname someone typed an email into', () => {
    const { clean } = screenPii('rim.07@school.edu');
    expect(clean).not.toContain('@');
    expect(clean).toContain('[email]');
  });

  it('redacts a phone number typed as a nickname', () => {
    const { clean } = screenPii('+216 55 123 456');
    expect(clean).toContain('[phone]');
  });

  it('leaves a normal nickname alone, including Arabic and darija', () => {
    for (const nick of ['Rim-07', 'ياسين', 'سلمى-02', 'Prof. Amine']) {
      expect(screenPii(nick).clean).toBe(nick);
    }
  });
});
