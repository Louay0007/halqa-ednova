import { NavLink, Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api, type Health } from '../lib/api';
import { degradationCopy, useSession } from '../lib/session';
import { t } from '../lib/i18n';
import { QuotaMeter, SbuRings } from '../components/ui';
import LogoIcon from '../assets/logo-icon';
import { SetupHint } from './SetupHint';
import { PassportSheet } from './PassportSheet';

const LANGS = ['fr', 'darija', 'ar', 'en'] as const;

function NightField() {
  return (
    <>
      <img className="app-bg" src="/hero-bg.avif" alt="" aria-hidden="true" />
      <div className="app-veil" aria-hidden="true" />
    </>
  );
}

/** Landing and /enter carry their own chrome (full-bleed escapes in
 *  shell.css) — the boot gate must not block them while the API is down. */
const UNGATED = ['/', '/enter'];

export function Shell({ children }: { children: React.ReactNode }) {
  const { lang, setLang, learnerId, circleId, joinCode, sessionId, metrics } = useSession();
  /** Health keyed by circle id: switching circles (or leaving one) reads as
   *  "no health yet" without a synchronous setState inside the poller effect. */
  const [healthFor, setHealthFor] = useState<{ circleId: string; data: Health } | null>(null);
  const [up, setUp] = useState<boolean | null>(null); // boot gate: null = checking
  const [sheetOpen, setSheetOpen] = useState(false);
  const [codePop, setCodePop] = useState(false);
  const [copied, setCopied] = useState(false);
  const loc = useLocation();

  // Boot gate (spec §3.5): one readiness probe; failure → SetupHint.
  // `healthz` is liveness only — it stays 200 with Mongo disconnected, so
  // gating on it let the shell render and then every data call 500'd.
  // `readyz` reports the connection, which is the thing boot actually needs.
  useEffect(() => {
    if (UNGATED.includes(loc.pathname)) return;
    let dead = false;
    api
      .readyz()
      .then((r) => {
        if (!dead) setUp(r.data.ok);
      })
      .catch(() => {
        if (!dead) setUp(false);
      });
    return () => {
      dead = true;
    };
  }, [loc.pathname]);

  // Circle health — 5s poller, paused while hidden (spec §3.1 header rings).
  useEffect(() => {
    if (!circleId) return;
    let dead = false;
    const tick = () => {
      if (document.hidden) return;
      api
        .circleHealth(circleId)
        .then((r) => {
          if (!dead) setHealthFor({ circleId, data: r.data });
        })
        .catch(() => undefined);
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => {
      dead = true;
      clearInterval(id);
    };
  }, [circleId]);

  const health = healthFor && healthFor.circleId === circleId ? healthFor.data : null;
  const mode = metrics?.degradation ?? 'green';
  const banner = degradationCopy(mode, lang);
  const usage = sessionId ? metrics?.quotaUsage.find((u) => u.sessionId === sessionId) : undefined;
  const params = new URLSearchParams(loc.search);
  const lab = params.has('lab');
  // Board/Lab are workshop surfaces (spec §3.1) — hidden from plain learners.
  const workshop = sessionStorage.getItem('halqa.context') === 'workshop' || lab;

  /** What a peer can actually act on. The Mongo id is an internal handle: the join
   *  endpoint (`GET /circles/by-code/:code`) only knows the 6-character code, so every
   *  share surface — chip, copy, QR deep link — must carry that instead. */
  const share = joinCode || circleId;

  const copyCode = () => {
    navigator.clipboard?.writeText(share).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const bare = UNGATED.includes(loc.pathname);
  /** The probe result is advisory, not a gate. `main.tsx` already renders a
   *  dismissible notice for the same failure, and every screen that can work
   *  offline (landing, /enter, the passport) must not be replaced by a wall. */
  const apiDown = up === false && !bare;

  return (
    <div className={bare ? 'shell' : 'shell is-app'}>
      {!bare && <NightField />}
      <a className="skip" href="#main">
        {t('skip_content', lang)}
      </a>
      <header className="topbar">
        <Link to="/" className="brand" translate="no" aria-label="HALQA">
          <LogoIcon className="brand-mark" />
          <span>HALQA</span>
        </Link>
        {circleId && (
          <div className="code-wrap">
            <button
              type="button"
              className="code-chip tnum"
              onClick={copyCode}
              aria-label={t('copy_code', lang)}
              translate="no"
              title={share}
            >
              {share}
            </button>
            <button
              type="button"
              className="code-qr-btn"
              onClick={() => setCodePop((v) => !v)}
              aria-expanded={codePop}
              aria-label={t('qr_circle', lang)}
            >
              ▦
            </button>
            {copied && (
              <span className="code-copied" role="status">
                {t('copied', lang)}
              </span>
            )}
            {codePop && (
              <div className="code-popover" role="dialog" aria-label={t('qr_circle', lang)}>
                <QRCodeSVG
                  value={`${window.location.origin}/circles/join?code=${encodeURIComponent(share)}`}
                  size={128}
                  role="img"
                  aria-label={t('qr_circle', lang)}
                />
                <p className="hint tnum" translate="no">
                  {share}
                </p>
              </div>
            )}
          </div>
        )}
        <div className="top-right">
          {health && <SbuRings S={health.S} B={health.B} U={health.U} />}
          {usage && <QuotaMeter cUsed={usage.cUsed} cCap={usage.cCap} lUsed={usage.lUsed} lCap={usage.lCap} />}
          <label className="lang">
            <span className="visually-hidden">{t('passport_lang', lang)}</span>
            <select value={lang} onChange={(e) => setLang(e.target.value as typeof lang)} aria-label={t('passport_lang', lang)}>
              {LANGS.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          {learnerId && (
            <button
              type="button"
              className="avatar-chip"
              onClick={() => setSheetOpen(true)}
              aria-label={t('open_passport', lang)}
              translate="no"
            >
              {learnerId}
            </button>
          )}
        </div>
      </header>
      {banner && (
        <div className={`degrade-banner degrade-${mode}`} role="status" aria-live="polite">
          {banner}
        </div>
      )}
      <main id="main">
        {apiDown && (
          <div className="page narrow setup-inline">
            <SetupHint lang={lang} onRetry={() => window.location.reload()} />
          </div>
        )}
        {children}
      </main>
      <nav className="bottomnav" aria-label={t('nav_label', lang)}>
        <NavLink to={circleId ? `/c/${circleId}` : '/circles/join'}>{t('nav_circle', lang)}</NavLink>
        <NavLink to="/me">{t('nav_passport', lang)}</NavLink>
        {workshop && <NavLink to="/board">{t('nav_board', lang)}</NavLink>}
        {workshop && <NavLink to={`/lab${lab ? '?lab=1' : ''}`}>{t('nav_lab', lang)}</NavLink>}
      </nav>
      {sheetOpen && <PassportSheet onClose={() => setSheetOpen(false)} />}
    </div>
  );
}
