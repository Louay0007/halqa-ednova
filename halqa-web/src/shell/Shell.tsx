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
  const { lang, setLang, learnerId, circleId, sessionId, metrics } = useSession();
  const [health, setHealth] = useState<Health | null>(null);
  const [up, setUp] = useState<boolean | null>(null); // boot gate: null = checking
  const [sheetOpen, setSheetOpen] = useState(false);
  const [codePop, setCodePop] = useState(false);
  const [copied, setCopied] = useState(false);
  const loc = useLocation();

  // Boot gate (spec §3.5): one healthz probe; failure → SetupHint.
  useEffect(() => {
    if (UNGATED.includes(loc.pathname)) return;
    let dead = false;
    api
      .healthz()
      .then(() => {
        if (!dead) setUp(true);
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
    if (!circleId) {
      setHealth(null);
      return;
    }
    let dead = false;
    const tick = () => {
      if (document.hidden) return;
      api
        .circleHealth(circleId)
        .then((r) => {
          if (!dead) setHealth(r.data);
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

  const mode = metrics?.degradation ?? 'green';
  const banner = degradationCopy(mode, lang);
  const usage = sessionId ? metrics?.quotaUsage.find((u) => u.sessionId === sessionId) : undefined;
  const params = new URLSearchParams(loc.search);
  const lab = params.has('lab');
  // Board/Lab are workshop surfaces (spec §3.1) — hidden from plain learners.
  const workshop = sessionStorage.getItem('halqa.context') === 'workshop' || lab;

  const copyCode = () => {
    navigator.clipboard?.writeText(circleId).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const bare = UNGATED.includes(loc.pathname);

  if (up === false && !bare) {
    return (
      <div className="shell is-app">
        <NightField />
        <main id="main">
          <SetupHint lang={lang} onRetry={() => window.location.reload()} />
        </main>
      </div>
    );
  }

  return (
    <div className={bare ? 'shell' : 'shell is-app'}>
      {!bare && <NightField />}
      <a className="skip" href="#main">
        {t('skip_content', lang)}
      </a>
      <header className="topbar">
        <Link to="/" className="brand" translate="no" aria-label="HALQA home">
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
            >
              {circleId}
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
                  value={`${window.location.origin}/circles/join?code=${circleId}`}
                  size={128}
                  role="img"
                  aria-label={t('qr_circle', lang)}
                />
                <p className="hint tnum" translate="no">
                  {circleId}
                </p>
              </div>
            )}
          </div>
        )}
        <div className="top-right">
          {health && <SbuRings S={health.S} B={health.B} U={health.U} />}
          {usage && <QuotaMeter cUsed={usage.cUsed} cCap={usage.cCap} lUsed={usage.lUsed} lCap={usage.lCap} />}
          <label className="lang">
            <span className="visually-hidden">Language</span>
            <select value={lang} onChange={(e) => setLang(e.target.value as typeof lang)} aria-label="Language">
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
      <main id="main">{children}</main>
      <nav className="bottomnav" aria-label="Primary">
        <NavLink to={circleId ? `/c/${circleId}` : '/circles/join'}>{t('nav_circle', lang)}</NavLink>
        <NavLink to="/me">{t('nav_passport', lang)}</NavLink>
        {workshop && <NavLink to="/board">{t('nav_board', lang)}</NavLink>}
        {workshop && <NavLink to={`/lab${lab ? '?lab=1' : ''}`}>{t('nav_lab', lang)}</NavLink>}
      </nav>
      {sheetOpen && <PassportSheet onClose={() => setSheetOpen(false)} />}
    </div>
  );
}
