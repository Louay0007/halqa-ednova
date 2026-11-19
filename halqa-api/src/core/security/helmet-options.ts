import type { HelmetOptions } from 'helmet';

/**
 * Security headers, as data.
 *
 * Extracted from `main.ts` so the policy can be asserted in a unit test: a CSP
 * that is only ever written inline can be weakened in review and nothing notices.
 * Helmet's defaults leave `script-src` unrestricted, which is the one directive
 * that matters against XSS — and the bearer token lives in `sessionStorage`, so
 * XSS is session theft rather than a cosmetic bug (§3.9).
 *
 * `styleSrc` allows `'unsafe-inline'` and the others do not: Vite injects the
 * critical CSS inline at build time, so a strict `style-src` breaks first paint.
 * Inline *style* under `script-src 'self'` cannot execute script, which is the
 * boundary that matters.
 */
export function helmetOptions(corsOrigins: string[]): HelmetOptions {
  return {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        // The API host must be reachable from the app; `corsOrigins` is the only
        // externally-controlled entry here, so it is passed rather than guessed.
        connectSrc: ["'self'", ...corsOrigins],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'self'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'no-referrer' },
  };
}
