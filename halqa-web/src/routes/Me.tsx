import { useEffect, useState } from 'react';
import { Link, useNavigate } from "react-router-dom";
import { ApiFailure, api, type Lang } from '../lib/api';
import { useSession } from '../lib/session';
import { t } from '../lib/i18n';
import { AVATARS, iconFor } from '../lib/avatars';
import { PassportView } from '../components/PassportView';

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
  const [avatarMsg, setAvatarMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);

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

  /** Persist a new avatar. `PATCH /me` is the only endpoint that can change it
   *  after creation, and it rejects keys outside AVATAR_KEYS, not substitutes. */
  const pickAvatar = async (key: string) => {
    if (avatarBusy || key === data?.learner.avatarKey) return;
    setAvatarBusy(true);
    setAvatarMsg(null);
    try {
      const r = await api.updateMe({ avatarKey: key });
      setData((d) => (d ? { ...d, learner: { ...d.learner, avatarKey: r.avatarKey } } : d));
      setAvatarMsg({ ok: true, text: t('avatar_saved', lang) });
    } catch (e) {
      const f = e as ApiFailure;
      setAvatarMsg({ ok: false, text: f.body?.user_msg?.[lang as Lang] ?? t('avatar_failed', lang) });
    } finally {
      setAvatarBusy(false);
    }
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
      setPwMsg({ ok: true, text: t('pw_rotated', lang) });
    } catch (e) {
      const f = e as ApiFailure;
      const code = f.body?.code ?? '';
      setPwMsg({
        ok: false,
        text:
          code === 'LOGIN_FAILED'
            ? t('pw_wrong_current', lang)
            : code === 'PASSPHRASE_LENGTH'
              ? t('pw_too_short', lang)
              : (f.body?.user_msg?.[lang as Lang] ?? t('pw_update_failed', lang)),
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
            {t('xp_badges', lang, { n: xp.total, b: xp.badges.join(', ') || '—' })}
          </p>
        )}
      </section>

      <section className="auth-card">
        <fieldset className="avatar-field">
          <legend className="hint">{t('enter_avatar', lang)}</legend>
          <div className="avatars" role="radiogroup" aria-label={t('enter_avatar', lang)} translate="no">
            {AVATARS.map((a) => (
              <label key={a} className={`avatar-opt${data.learner.avatarKey === a ? ' avatar-opt-on' : ''}`}>
                <input
                  type="radio"
                  name="avatar"
                  value={a}
                  checked={data.learner.avatarKey === a}
                  disabled={avatarBusy}
                  onChange={() => pickAvatar(a)}
                />
                <span aria-hidden="true">{iconFor(a)}</span>
                <span className="visually-hidden">{a}</span>
              </label>
            ))}
          </div>
          <p className="hint">{t('avatar_hint', lang)}</p>
          {avatarMsg && (
            <p className={`hint${avatarMsg.ok ? ' ok' : ''}`} role="status">
              {avatarMsg.text}
            </p>
          )}
        </fieldset>
      </section>

      {data.learner.handle ? (
        <section className="auth-card">
          <h2 className="hint" style={{ margin: 0 }}>
            {t('account', lang)}
          </h2>
          <form onSubmit={rotatePassphrase} className="flex flex-col gap-3" noValidate>
            <div>
              <label htmlFor="pw-current" className="hint">
                {t('pw_current', lang)}
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
                {t('pw_new', lang)}
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
              <p className="hint">{t('pw_min_hint', lang)}</p>
            </div>
            {pwMsg && (
              <p className={`hint${pwMsg.ok ? ' ok' : ''}`} role="status">
                {pwMsg.text}
              </p>
            )}
            <button type="submit" className="btn btn-small" disabled={pwBusy || !current || next.length < 8}>
              {pwBusy ? t('pw_updating', lang) : t('pw_update', lang)}
            </button>
          </form>
        </section>
      ) : (
        <section className="auth-card">
          <p className="hint" style={{ margin: 0 }}>
            {t('guest_record_hint', lang)} <Link to="/enter">/enter</Link> {t('guest_record_tail', lang)}
          </p>
        </section>
      )}

      <footer className="auth-foot">
        <button type="button" className="btn btn-ghost btn-small" onClick={signOut} disabled={busy}>
          {busy ? t('signing_out', lang) : t('sign_out', lang)}
        </button>
        <span className="hint">{t('signout_hint', lang)}</span>
      </footer>
    </div>
  );
}
