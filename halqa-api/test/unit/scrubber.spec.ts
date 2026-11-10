import { scrubLine } from '../../src/core/logger/scrubber';

describe('scrubber', () => {
  it('redacts emails', () => {
    expect(scrubLine('contact user@example.com ok')).toContain('[EMAIL_REDACTED]');
    expect(scrubLine('contact user@example.com ok')).not.toContain('user@example.com');
  });
  it('redacts bearer tokens and api keys', () => {
    expect(scrubLine('Bearer abcdefghijklmnop')).toContain('[REDACTED]');
    expect(scrubLine('api_key=abcdefghijklmnop')).toContain('[REDACTED]');
  });
  it('redacts sk- keys partially (prefix kept for debugging)', () => {
    const out = scrubLine('key sk-abcdef1234567890');
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('sk-abcdef1234567890');
  });
  it('log timestamps survive the scrubber intact', () => {
    const ts = new Date().toISOString();
    expect(scrubLine(`{"ts":"${ts}"}`)).toContain(ts);
  });
  it('redacts phone numbers but keeps short numbers (ports, years)', () => {
    expect(scrubLine('call +216 12 345 678 now')).toContain('[PHONE_REDACTED]');
    expect(scrubLine('listening on :3000')).toContain('3000');
  });
});
