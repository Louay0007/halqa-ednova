import type { ReactNode } from 'react';
import Hero15, { type NavLinkItem } from '../components/watermelon-ui/hero-15';
import { useSession } from '../lib/session';
import type { Lang } from '../lib/api';

// Landing is the hero and nothing else. Its own nav carries the brand, the
// language switch and the entry CTAs — the app rail is hidden for this route
// (`.shell:has(.landing-hero)` in shell.css) so the dark panel can reach the edges.

const LANGS: Lang[] = ['fr', 'darija', 'ar', 'en'];

const NAV: NavLinkItem[] = [
  { label: 'Circles', to: '/circles/join' },
  { label: 'Board', to: '/board' },
  { label: 'Passport', to: '/me' },
];

const PROOFS = [
  { value: '4 → 0', label: 'AI calls once the network drops' },
  { value: 'H1 → H4', label: 'Hint ladder before any answer' },
  { value: '4', label: 'French · Arabic · Darija · English' },
];

export function Landing() {
  const { lang, setLang } = useSession();

  const langSwitch = (
    <label className="relative hidden sm:block">
      <span className="visually-hidden">Language</span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        aria-label="Language"
        className="min-h-11 appearance-none rounded-md border border-white/20 bg-white/10 pe-7 ps-2.5 text-xs font-medium tracking-[0.08em] text-white/80 uppercase outline-none backdrop-blur-md transition-colors duration-200 hover:bg-white/15"
      >
        {LANGS.map((l) => (
          <option key={l} value={l} className="text-ink">
            {l.toUpperCase()}
          </option>
        ))}
      </select>
      {/* appearance-none is required for min-h to apply on a native select in
          Safari/WebKit, so the platform chevron is drawn back in by hand. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute end-2 top-1/2 size-3 -translate-y-1/2 text-white/60"
      >
        <path d="M3 4.5 6 7.5 9 4.5" />
      </svg>
    </label>
  );

  const footnote: ReactNode = (
    <>
      Anonymous · synthetic data only · the AI supports teachers, never replaces them · IEEE SB / WIE
      {lang === 'fr' && ' · Aucune voix laissée de côté.'}
    </>
  );

  return (
    <div className="landing-hero">
      <Hero15
        navLinks={NAV}
        navExtra={langSwitch}
        headingLine1="No voice"
        headingLine2="left behind"
        description="Peer study circles, mediated by AI. Learners answer first; the AI steps in only afterwards — with a credit economy, an offline fallback and four languages."
        primaryCtaLabel="Join a circle"
        primaryCtaTo="/enter"
        secondaryCtaLabel="Have a code?"
        secondaryCtaTo="/circles/join"
        signupLabel="Sign in"
        signupTo="/enter"
        proofEyebrow="Peers first, by design"
        proofs={PROOFS}
        footnote={footnote}
      />
    </div>
  );
}
