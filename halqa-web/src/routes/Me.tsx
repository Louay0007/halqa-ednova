import { useEffect, useState } from 'react';
import { Link, useNavigate } from "react-router-dom";
import { ApiFailure, api, type Lang } from '../lib/api';
import { useSession } from '../lib/session';
import { t } from '../lib/i18n';
import { iconFor } from '../lib/avatars';
import { PassportView } from './Dna';

interface MeData {
  learner: { id?: string; nickname?: string; avatarKey?: string; context?: string; handle?: string | null };
  passport: Record<string, unknown> | null;
}

export function Me() {
  const { learnerId, lang, login, logout } = useSession();
  const nav = useNavigate();
  const [data, setData] = useState<MeData | null>(null);
  const [xp, setXp] = useState<{ total: number; badges: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  // Passphrase rotation — only meaningful once the record is a real account.
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    api
      .me()
      .then((r) => setData(r.data as MeData))
      .catch(() => undefined);
    if (learnerId)
      api
        .xp(learnerId)
        .then((r) => setXp(r.data))
        .catch(() => undefined);
  }, [learnerId]);

  const signOut = () => {
    setBusy(true);
    // Revoke server-side (epoch bump) before dropping the local token, so a
    // copied token cannot outlive the sign-out.
    api
      .signout()
      .catch(() => undefined)
      .finally(() => {
        logout();
        nav('/enter', { replace: true });
      });
  };

  const rotatePassphrase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwBusy || !current || next.length < 8) return;
    setPwBusy(true);
    setPwMsg(null);
    try {
      // The epoch bumps on rotation, so the server mints a fresh token — adopt
      // it here or the next guarded call would be rejected.
      const r = await api.changePassphrase(current, next);
      login(r.token, learnerId);
      setCurrent('');
      setNext('');
      setPwMsg({ ok: true, text: 'Passphrase updated — this device is signed in with it.' });
    } catch (e) {
      const f = e as ApiFailure;
      const code = f.body?.code ?? '';
      setPwMsg({
        ok: false,
        text:
          code === 'LOGIN_FAILED'
            ? 'Wrong current passphrase.'
            : code === 'PASSPHRASE_LENGTH'
              ? 'Use at least 8 characters.'
              : (f.body?.user_msg?.[lang as Lang] ?? 'Could not update — try again.'),
      });
    } finally {
      setPwBusy(false);
    }
  };

  if (!data) {
    return (
      <div className="page narrow auth">
        <div className="skel" style={{ height: 96 }} />
      </div>
    );
  }

  const nick = data.learner.nickname ?? learnerId;

  return (
    <div className="page narrow auth">
      <header className="auth-head">
        <h1>{t('nav_passport', lang)}</h1>
        <p className="auth-lede">{t('me_lede', lang)}</p>
      </header>

      <section className="auth-card">
        <div className="identity">
          <span className="identity-glyph" aria-hidden="true" translate="no">
            {iconFor(data.learner.avatarKey)}
          </span>
          <div className="identity-text">
            <h2 translate="no">{nick}</h2>
            <span className="hint tnum" translate="no">
              {data.learner.handle ? `@${data.learner.handle}` : learnerId}
            </span>
          </div>
        </div>

        {data.passport ? (
          <PassportView p={data.passport} />
        ) : (
          <p className="hint" style={{ margin: 0 }}>
            {t('no_passport', lang)}
          </p>
        )}

        {xp && (
          <p className="hint tnum">
            XP {xp.total} · badges {xp.badges.join(', ') || '—'}
          </p>
        )}
      </section>

      {data.learner.handle ? (
        <section className="auth-card">
          <h2 className="hint" style={{ margin: 0 }}>
            Account
          </h2>
          <form onSubmit={rotatePassphrase} className="flex flex-col gap-3" noValidate>
            <div>
              <label htmlFor="pw-current" className="hint">
                Current passphrase
              </label>
              <input
                id="pw-current"
                type="password"
                autoComplete="current-password"
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="pw-next" className="hint">
                New passphrase
              </label>
              <input
                id="pw-next"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
              <p className="hint">8 characters minimum. Rotation signs every other device out.</p>
            </div>
            {pwMsg && (
              <p className="hint" role="status">
                {pwMsg.text}
              </p>
            )}
            <button type="submit" className="btn btn-small" disabled={pwBusy || !current || next.length < 8}>
              {pwBusy ? 'Updating…' : 'Update passphrase'}
            </button>
          </form>
        </section>
      ) : (
        <section className="auth-card">
          <p className="hint" style={{ margin: 0 }}>
            This is still a guest record. Claim an account from <Link to="/enter">/enter</Link> to keep your passport on
            any device.
          </p>
        </section>
      )}

      <footer className="auth-foot">
        <button type="button" className="btn btn-ghost btn-small" onClick={signOut} disabled={busy}>
          {busy ? 'Signing out…' : 'Sign out'}
        </button>
        <span className="hint">Revokes this device token.</span>
      </footer>
    </div>
  );
}
