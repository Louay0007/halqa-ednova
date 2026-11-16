import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useSession } from '../lib/session';

// Landing hero — ported from the BASE/CLUB reference to HALQA tokens.
// ponytail: no Tailwind/motion. Float = CSS keyframes, reveal = IntersectionObserver.
// Swap to Tailwind + motion only if the whole app moves off tokens.css.

const HERO_INK = '#0038ff';
const HERO_LIME = '#ccff00';

const Arrow: React.FC<{ d: string; head: string; className: string; width?: number }> = ({ d, head, className, width = 5 }) => (
  <svg
    viewBox="0 0 100 100"
    className={`hero-arrow ${className}`}
    fill="none"
    stroke="currentColor"
    strokeWidth={width}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={d} />
    <path d={head} />
  </svg>
);

function CircularBadge() {
  return (
    <div className="hero-badge">
      <div className="hero-badge-spin">
        <svg viewBox="0 0 100 100">
          <defs>
            <path id="halqaCirclePath" d="M 50, 50 m -36, 0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0" fill="none" />
          </defs>
          <text className="hero-badge-text" fill="black">
            <textPath href="#halqaCirclePath" startOffset="0%">
              JOIN A CIRCLE FOR FREE • JOIN A CIRCLE FOR FREE •{' '}
            </textPath>
          </text>
        </svg>
      </div>
      <svg viewBox="0 0 100 100" className="hero-badge-arrow" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20,80 Q 40,50 30,30 T 80,20" />
        <path d="M60,10 L80,20 L70,40" />
      </svg>
    </div>
  );
}

const HATS = [
  ['Mediator', 'وسيط', 'Balances voices, invites the quiet, cools dominators.'],
  ['Teammate', 'زميل', 'Thinks aloud with you — sometimes wrong so you correct it.'],
  ['Tutor', 'معلّم', 'Explains at your level, style and language, grounded in lessons.'],
  ['Facilitator', 'مسيّر', 'Runs the clock, the hints, the checks and the close.'],
] as const;

export function Landing() {
  const { lang } = useSession();
  const [docs, setDocs] = useState<number | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    api.kbStats().then((r) => setDocs(r.data.docs)).catch(() => undefined);
    // ponytail: one-shot reveal, no lib. Add stagger only if it looks static.
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Farsi-style display stack; matches the reference's "Arial Black, Impact".
  const shadow = Array.from({ length: 14 }, (_, i) => `${i + 1}px ${i + 1}px 0 #001a99`).join(', ');
  const display = { fontFamily: '"Arial Black", Impact, sans-serif', textShadow: shadow } as const;

  return (
    <div className={`hero-root${shown ? ' hero-in' : ''}`} style={{ ['--hero-ink' as string]: HERO_INK, ['--hero-lime' as string]: HERO_LIME }}>
      <div className="hero-grid-bg" aria-hidden="true" />

      <main className="hero-stage">
        <div className="hero-stack">
          <div className="hero-line hero-line-1">
            <h1 className="hero-display" style={{ ...display, color: 'var(--hero-lime)' }}>
              HALQA
            </h1>
          </div>
          <div className="hero-line hero-line-2">
            <h1 className="hero-display hero-display-lg" style={{ ...display, color: '#fff' }}>
              NO VOICE
            </h1>
          </div>
          <div className="hero-line hero-line-3">
            <h1 className="hero-display" style={{ ...display, color: '#fff' }}>
              LEFT BEHIND
            </h1>
          </div>
        </div>

        <div className="hero-overlays">
          <div className="hero-card hero-card-a">
            <div className="hero-card-inner">
              <div className="hero-avatar hero-avatar-a" aria-hidden="true">
                🦉
              </div>
              <p className="hero-card-name">Rim-07</p>
              <p className="hero-card-meta">2 342 credits</p>
            </div>
          </div>

          <div className="hero-card hero-card-b">
            <div className="hero-card-inner">
              <div className="hero-avatar hero-avatar-b" aria-hidden="true">
                🦊
              </div>
              <p className="hero-card-name">Yassine</p>
              <p className="hero-card-meta">1 883 credits</p>
            </div>
          </div>

          <Arrow d="M10,90 C 10,40 40,20 60,50 C 70,65 80,75 95,70" head="M80,55 L95,70 L85,85" className="hero-arrow-a" width={6} />
          <Arrow d="M90,10 C 80,60 60,80 40,60 C 20,40 40,20 60,30 C 80,40 70,70 50,80" head="M65,75 L50,80 L55,65" className="hero-arrow-b" width={6} />

          <a className="hero-badge-link" href="#join" aria-label="Join a circle — free">
            <CircularBadge />
          </a>
        </div>
      </main>

      <section className="hero-features" id="join">
        <div className="hero-features-grid">
          <article className="hero-feature-card">
            <h3>PEERS ANSWER FIRST</h3>
            <p>The circle starts talking before Nova says a word. {docs ?? 39} synthetic KB chunks behind every check.</p>
            <div className="hero-pill">
              <span className="hero-pill-avatar" aria-hidden="true">🦉</span>
              <span className="hero-pill-text">
                <strong>Rim-07</strong>
                <small>asks the first question</small>
              </span>
              <span className="hero-pill-badge">45s</span>
            </div>
            <Arrow d="M20,80 Q 40,20 80,40" head="M60,20 L80,40 L50,60" className="hero-arrow-c" />
          </article>

          <article className="hero-feature-card">
            <h3>PEER-FIRST WINDOW</h3>
            <p>Hints arrive one rung at a time. The answer stays locked until 1–3 are spent.</p>
            <div className="hero-pill hero-pill-round">
              <span className="hero-pill-value">H1 → H4</span>
              <span className="hero-pill-unit">ladder</span>
              <span className="hero-pill-dot" aria-hidden="true">
                ↗
              </span>
            </div>
            <Arrow d="M20,80 Q 40,20 80,40" head="M60,20 L80,40 L50,60" className="hero-arrow-c" />
          </article>

          <article className="hero-feature-card">
            <h3>THE AI SLEEPS —<br />THE CIRCLE LEARNS</h3>
            <p>Quota out, Wi-Fi down: the tools still work, the debrief still lands.</p>
            <div className="hero-bubble">
              <p className="hero-bubble-label">EVEN OFFLINE</p>
              <p className="hero-bubble-value">4 → 0 calls</p>
              <span className="hero-bubble-tail" aria-hidden="true" />
            </div>
          </article>
        </div>

        <div className="hero-cta">
          <Link className="hero-btn" to="/enter?context=solo">
            ▶ Solo — teach Nova
          </Link>
          <Link className="hero-btn hero-btn-ghost" to="/enter">
            👥 Circle
          </Link>
          <Link className="hero-btn hero-btn-ghost" to="/circles/join">
            Have a code?
          </Link>
        </div>

        <ul className="hero-hats" aria-label="Nova roles">
          {HATS.map(([en, ar, desc]) => (
            <li key={en}>
              <strong translate="no">
                {en} · {ar}
              </strong>
              <span>{desc}</span>
            </li>
          ))}
        </ul>

        <p className="hero-foot">
          Anonymous · synthetic data only · the AI supports teachers, never replaces them. IEEE SB/WIE.
          {lang === 'fr' && ' Aucune voix laissée de côté.'}
        </p>
      </section>
    </div>
  );
}
