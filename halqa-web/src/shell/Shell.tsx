import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api, type Health } from '../lib/api';
import { degradationCopy, useSession } from '../lib/session';
import { t } from '../lib/i18n';
import { QuotaMeter, SbuRings } from '../components/ui';

const LANGS = ['fr', 'darija', 'ar', 'en'] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const { lang, setLang, learnerId, circleId, sessionId, metrics } = useSession();
  const [health, setHealth] = useState<Health | null>(null);
  const loc = useLocation();
  const nav = useNavigate();

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
  const lab = new URLSearchParams(loc.search).has('lab');

  return (
    <div className="shell">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <Link to="/" className="brand" translate="no" aria-label="HALQA home">
          ★ HALQA
        </Link>
        {circleId && (
          <button
            type="button"
            className="code-chip tnum"
            onClick={() => navigator.clipboard?.writeText(circleId).catch(() => undefined)}
            aria-label={`Circle ${circleId}, tap to copy`}
            translate="no"
          >
            {circleId}
          </button>
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
            <button type="button" className="avatar-chip" onClick={() => nav('/me')} aria-label="Open passport" translate="no">
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
        <Link to={circleId ? `/c/${circleId}` : '/circles/join'}>{t('peers_first', lang).split('—')[0]}</Link>
        <Link to="/me">Passport</Link>
        <Link to="/dashboard">Board</Link>
        {lab && <Link to="/lab?lab=1">Lab</Link>}
      </nav>
    </div>
  );
}
