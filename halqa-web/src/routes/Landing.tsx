import type { ReactNode } from 'react';
import Hero15, { type NavLinkItem } from '../components/watermelon-ui/hero-15';
import { useSession } from '../lib/session';
import type { Lang } from '../lib/api';
import { t } from '../lib/i18n';

// Landing is the hero and nothing else. Its own nav carries the brand, the
// language switch and the entry CTAs — the app rail is hidden for this route
// (`.shell:has(.landing-hero)` in shell.css) so the dark panel can reach the edges.

const LANGS: Lang[] = ['fr', 'darija', 'ar', 'en'];

export function Landing() {
  const { lang, setLang } = useSession();

  // Built in the component, not at module scope: the labels depend on the
  // current language, and a module constant would keep whichever one rendered first.
  const nav: NavLinkItem[] = [
    { label: t('nav_circles', lang), to: '/circles/join' },
    { label: t('nav_board', lang), to: '/board' },
    { label: t('nav_passport', lang), to: '/me' },
  ];

  // The `value` fields stay literal — `4 → 0`, `H1 → H4` and `4` are numerals, not prose.
  const proofs = [
    { value: '4 → 0', label: t('landing_proof_offline', lang) },
    { value: 'H1 → H4', label: t('landing_proof_ladder', lang) },
    { value: '4', label: t('landing_proof_langs', lang) },
  ];

  const langSwitch = (
    <label className="relative hidden sm:block">
      <span className="visually-hidden">{t('passport_lang', lang)}</span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        aria-label={t('passport_lang', lang)}
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

  const footnote: ReactNode = t('landing_footnote', lang);

  return (
    <div className="landing-hero">
      <Hero15
        navLinks={nav}
        navExtra={langSwitch}
        headingLine1={t('landing_h1', lang)}
        headingLine2={t('landing_h2', lang)}
        description={t('landing_desc', lang)}
        primaryCtaLabel={t('join_circle', lang)}
        primaryCtaTo="/enter"
        secondaryCtaLabel={t('have_code_short', lang)}
        secondaryCtaTo="/circles/join"
        signupLabel={t('enter_signin_cta', lang)}
        signupTo="/enter"
        proofEyebrow={t('landing_proof_eyebrow', lang)}
        proofs={proofs}
        footnote={footnote}
      />
    </div>
  );
}
