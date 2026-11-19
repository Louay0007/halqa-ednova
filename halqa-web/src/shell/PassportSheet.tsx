import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiFailure } from '../lib/api';
import { useSession } from '../lib/session';
import { t } from '../lib/i18n';
import { PassportView } from '../components/PassportView';
import { iconFor } from '../lib/avatars';

interface MeData {
  learner: { id?: string; nickname?: string; avatarKey?: string; handle?: string | null };
  passport: Record<string, unknown> | null;
}

/** Spec §3.4 — passport slide-over, reachable from every route via the
 *  avatar chip. Reuses the /me identity work: PassportView + the account
 *  card (passphrase rotation) or the guest upgrade hint. */
export function PassportSheet({ onClose }: { onClose: () => void }) {
  const { lang, learnerId, login, logout } = useSession();
  const [data, setData] = useState<MeData | null>(null);
  const [xp, setXp] = useState<{ total: number; badges: string[]; streakDays: number } | null>(null);
  const [explain, setExplain] = useState<{ card: string; visible: boolean } | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    api.me().then((r) => setData(r.data as MeData)).catch(() => undefined);
    if (learnerId) {
      api.progress().then((r) => setXp(r.data)).catch(() => undefined);
      api.explainCard(learnerId).then((r) => setExplain(r.data)).catch(() => undefined);
    }
  }, [learnerId]);

  useEffect(() => {
    closeRef.current?.focus();
    const panel = panelRef.current;
    /** `aria-modal="true"` promises the rest of the page is inert. Without a trap
     *  the learner tabs straight out into the shell behind the sheet. */
    const focusables = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !panel?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const rotatePassphrase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwBusy || !current || next.length < 8) return;
    setPwBusy(true);
    setPwMsg(null);
    try {
      // Epoch bumps on rotation — adopt the minted token.
      const r = await api.changePassphrase(current, next);
      login(r.token, learnerId);
      setCurrent('');
      setNext('');
      setPwMsg({ ok: true, text: t('pw_rotated', lang) });
    } catch (e) {
      const f = e as ApiFailure;
      setPwMsg({ ok: false, text: f.body?.user_msg?.[lang] ?? f.body?.code ?? '—' });
    } finally {
      setPwBusy(false);
    }
  };

  const signOut = () => {
    api
      .signout()
      .catch(() => undefined)
      .finally(() => {
        logout();
        onClose();
        window.location.assign('/enter');
      });
  };

  const nick = data?.learner?.nickname ?? learnerId ?? '';
  const handle = data?.learner?.handle;

  return (
    <div className="sheet-root">
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <aside ref={panelRef} className="sheet" role="dialog" aria-modal="true" aria-label={t('nav_passport', lang)}>
        <header className="sheet-head">
          <h2>{t('nav_passport', lang)}</h2>
          <button ref={closeRef} type="button" className="sheet-close" onClick={onClose} aria-label={t('close', lang)}>
            ✕
          </button>
        </header>

        <div className="sheet-body">
          <div className="identity">
            <span className="identity-glyph" aria-hidden="true" translate="no">
              {iconFor(data?.learner?.avatarKey)}
            </span>
            <div className="identity-text">
              <h2 translate="no">{nick}</h2>
              <span className="hint tnum" translate="no">
                {handle ? `@${handle}` : learnerId}
              </span>
            </div>
          </div>

          {data?.passport ? <PassportView p={data.passport} /> : <p className="muted">—</p>}

          {explain?.visible && (
            <blockquote className="explain-card">
              <p translate="no">{explain.card}</p>
            </blockquote>
          )}

          {xp && (
            <p className="hint tnum">
              XP {xp.total} · {xp.badges.join(' · ') || '—'}
            </p>
          )}

          {handle ? (
            <form onSubmit={rotatePassphrase} className="sheet-account" noValidate>
              <p className="hint" style={{ margin: 0 }}>
                {t('pw_hint', lang)}
              </p>
              <label className="hint" htmlFor="sheet-pw-cur">
                {t('pw_current', lang)}
              </label>
              <input
                id="sheet-pw-cur"
                type="password"
                autoComplete="current-password"
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                style={{ minHeight: 44 }}
              />
              <label className="hint" htmlFor="sheet-pw-new">
                {t('pw_new', lang)}
              </label>
              <input
                id="sheet-pw-new"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                style={{ minHeight: 44 }}
              />
              {pwMsg && (
                <p className={`hint${pwMsg.ok ? ' ok' : ''}`} role="status">
                  {pwMsg.text}
                </p>
              )}
              <button type="submit" className="btn btn-small" disabled={pwBusy || !current || next.length < 8} style={{ minHeight: 44 }}>
                {t('pw_update', lang)}
              </button>
            </form>
          ) : (
            <p className="hint" style={{ margin: 0 }}>
              {t('guest_upgrade', lang)}{' '}
              <Link to="/enter" onClick={onClose}>
                /enter
              </Link>
            </p>
          )}
        </div>

        <footer className="sheet-foot">
          <button type="button" className="btn btn-ghost btn-small" onClick={signOut} style={{ minHeight: 44 }}>
            {t('sign_out', lang)}
          </button>
        </footer>
      </aside>
    </div>
  );
}
