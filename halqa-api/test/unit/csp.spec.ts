import { helmetOptions } from '../../src/core/security/helmet-options';

/**
 * §3.9: the token lives in `sessionStorage`, so XSS is session theft. That is
 * acceptable only if the CSP is real *and tested* — the plan says so explicitly,
 * and "tested" is the half that was missing: the policy existed inline in
 * `main.ts` where nothing could assert it, so a future edit could drop
 * `scriptSrc` and every test would still pass.
 *
 * These assert the directives that actually stop an injected script, not the
 * presence of the header (which is on by default and therefore means nothing).
 */
function directives(): Record<string, string[]> {
  const opts = helmetOptions(['https://app.example.com']);
  const csp = opts.contentSecurityPolicy;
  if (typeof csp !== 'object' || csp === null) throw new Error('CSP is disabled');
  const d = csp.directives;
  if (!d) throw new Error('no directives');
  return d as Record<string, string[]>;
}

describe('content security policy (§3.9)', () => {
  it('restricts scripts to self — the directive that matters against XSS', () => {
    // The regression this prevents: helmet's default leaves script-src
    // unrestricted, so an injected <script src=...> runs.
    expect(directives().scriptSrc).toEqual(["'self'"]);
    expect(directives().scriptSrc).not.toContain("'unsafe-inline'");
    expect(directives().scriptSrc).not.toContain("'unsafe-eval'");
  });

  it('defaults to self, so a directive nobody thought of cannot be wide open', () => {
    expect(directives().defaultSrc).toEqual(["'self'"]);
  });

  it('blocks framing, plugins, base-uri hijacking and form exfiltration', () => {
    // frameAncestors stops clickjacking of a session that is already signed in;
    // baseUri stops a <base> tag redirecting every relative script; formAction
    // stops a form posting the (readable) token to an attacker.
    expect(directives().frameAncestors).toEqual(["'none'"]);
    expect(directives().objectSrc).toEqual(["'none'"]);
    expect(directives().baseUri).toEqual(["'none'"]);
    expect(directives().formAction).toEqual(["'self'"]);
  });

  it('allows inline styles but never inline script', () => {
    // Vite injects critical CSS inline, so a strict style-src breaks first paint.
    // Inline style under `script-src 'self'` cannot execute code, which is the
    // boundary being drawn — this is a deliberate exception, not an oversight.
    expect(directives().styleSrc).toContain("'unsafe-inline'");
    expect(directives().scriptSrc).not.toContain("'unsafe-inline'");
  });

  it('limits connect-src to self plus the configured origins, nothing wildcarded', () => {
    const connect = directives().connectSrc;
    expect(connect).toContain("'self'");
    expect(connect).toContain('https://app.example.com');
    expect(connect).not.toContain('*');
  });

  it('does not leak the referrer, and keeps resources same-site', () => {
    const opts = helmetOptions([]);
    expect(opts.referrerPolicy).toEqual({ policy: 'no-referrer' });
    expect(opts.crossOriginResourcePolicy).toEqual({ policy: 'same-site' });
  });

  it('an empty CORS list yields a tighter policy, not a wider one', () => {
    // The failure mode to avoid: falling back to `*` when no origin is configured.
    const connect = (helmetOptions([]).contentSecurityPolicy as { directives: Record<string, string[]> })
      .directives.connectSrc;
    expect(connect).toEqual(["'self'"]);
  });
});
