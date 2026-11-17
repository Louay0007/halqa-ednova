import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion, type Variants } from 'motion/react';
import LogoIcon from '../assets/logo-icon';
import { ApiFailure, api, type ContextMode } from '../lib/api';
import { useSession } from '../lib/session';
import { ErrorNote } from '../components/ui';
import { AVATARS, iconFor } from '../lib/avatars';

/**
 * /enter — the completed auth surface, in the landing hero's language: the
 * same navy-deep panel, the same backdrop image and glass, the same spring
 * reveals, on the opposite edge (forms instead of headlines).
 *
 * Three ways in, one card, no chrome:
 *  - Create account — handle + passphrase (`/auth/register`), which upgrades the
 *    guest record when one is on the token, so nothing learned is lost.
 *  - Sign in — the same two fields against `/auth/login`.
 *  - Try as a guest — `/auth/session`, the zero-credential path, kept because
 *    the landing page promises "under a minute".
 *
 * No email is asked for, ever: the account is a chosen pseudonym and a secret.
 * Styles live in pages.css (`.enter-*`) — see the note there on preflight.
 */

type Mode = 'signup' | 'signin' | 'guest';

/** Mirrors HANDLE_RE / PASSPHRASE_MIN in halqa-api/src/security/credentials.ts. */
const HANDLE_RE = /^[a-z0-9][a-z0-9_-]{2,19}$/;
const PASSPHRASE_MIN = 8;
const PASSPHRASE_MAX = 128;

const CONTEXTS: Array<{ id: ContextMode; label: string; desc: string }> = [
  { id: 'study', label: 'Study', desc: 'Revision circle with friends' },
  { id: 'class', label: 'Class', desc: 'Teacher-led lesson' },
  { id: 'workshop', label: 'Workshop', desc: 'Matched groups + mentor board' },
  { id: 'community', label: 'Community', desc: 'Low-bandwidth friendly' },
  { id: 'program', label: 'Program', desc: 'Repeated sessions, spaced review' },
  { id: 'solo', label: 'Solo', desc: 'Just you + Nova' },
];

const sectionVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
};
const softReveal: Variants = {
  hidden: { opacity: 0, y: 16, filter: 'blur(10px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { type: 'spring', mass: 1.2, stiffness: 40, damping: 15 } },
};

export function Enter() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { lang, login } = useSession();
  const reduce = useReducedMotion();

  const [mode, setMode] = useState<Mode>('signup');
  const [nickname, setNickname] = useState('');
  const [handle, setHandle] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [avatar, setAvatar] = useState<string>(() => AVATARS[Math.floor(Math.random() * AVATARS.length)]);
  const [context, setContext] = useState<ContextMode>(() => {
    const c = params.get('context') as ContextMode | null;
    return c && CONTEXTS.some((x) => x.id === c) ? c : 'study';
  });
  const [err, setErr] = useState<{ code: string; msg: string; retryable: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  // Fresh device: clear the fields so browser autofill of a nickname from a
  // previous session cannot lead the validation below astray.
  const pick = (m: Mode) => {
    setMode(m);
    setNickname('');
    setHandle('');
    setPassphrase('');
    setErr(null);
  };

  const isSignup = mode === 'signup';
  const isGuest = mode === 'guest';

  const handleProblem =
    handle.length === 0 || isGuest
      ? null
      : !HANDLE_RE.test(handle.trim())
        ? 'Use 3–20 letters, numbers, - or _'
        : null;
  const secretProblem =
    passphrase.length === 0 || isGuest
      ? null
      : passphrase.length < PASSPHRASE_MIN
        ? `At least ${PASSPHRASE_MIN} characters`
        : passphrase.length > PASSPHRASE_MAX
          ? `${PASSPHRASE_MAX} characters maximum`
          : null;

  const canSubmit =
    !busy &&
    (isGuest
      ? nickname.trim().length > 0
      : handleProblem === null && secretProblem === null && handle.trim().length > 0 && passphrase.length >= PASSPHRASE_MIN);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setErr(null);
    try {
      // Register upgrades the current (guest) record when one is on the token,
      // so progress made before signing up is kept.
      const r = isGuest
        ? await api.authSession(nickname.trim(), context, avatar)
        : isSignup
          ? await api.register({
              handle: handle.trim(),
              passphrase,
              nickname: nickname.trim() || undefined,
              avatarKey: avatar,
              context,
            })
          : await api.login(handle.trim(), passphrase);
      login(r.token, r.learner.id);
      const next = params.get('next');
      if (next) nav(next, { replace: true });
      else nav(context === 'solo' ? '/solo' : '/board', { replace: true });
    } catch (e) {
      const f = e as ApiFailure;
      setErr({
        code: f.body?.code ?? 'ENTER_FAILED',
        msg: f.body?.user_msg?.[lang] ?? 'Could not continue — try again.',
        retryable: f.body?.retryable ?? true,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="enter-hero">
      <div className="enter-frame">
        <img className="enter-bg" src="/hero-bg.avif" alt="" aria-hidden="true" />
        <div className="enter-veil" aria-hidden="true" />

        <motion.div
          initial={reduce ? 'visible' : 'hidden'}
          animate="visible"
          variants={sectionVariants}
          className="enter-body"
        >
          <motion.div variants={softReveal} className="enter-head">
            <Link to="/" className="enter-brand">
              <LogoIcon className="enter-logo" />
              <span translate="no">HALQA</span>
            </Link>
            <h1 className="enter-title">
              {isGuest ? 'Step in quietly' : isSignup ? 'Claim your seat' : 'Welcome back'}
            </h1>
            <p className="enter-sub">
              {isGuest
                ? 'A nickname, nothing more. Claim an account later from your passport.'
                : isSignup
                  ? 'A pseudonym and a passphrase. No email, nothing personal.'
                  : 'Sign back in from any device.'}
            </p>
          </motion.div>

          <motion.div variants={softReveal} className="enter-panel">
            <form onSubmit={submit} noValidate>
              <div className="enter-tabs" role="group" aria-label="Sign in, create an account, or try as a guest">
                {(['signup', 'signin', 'guest'] as const).map((m) => (
                  <button key={m} type="button" className={`enter-tab${mode === m ? ' is-on' : ''}`} aria-pressed={mode === m} onClick={() => pick(m)}>
                    {m === 'signup' ? 'Create account' : m === 'signin' ? 'Sign in' : 'Try it'}
                  </button>
                ))}
              </div>

              <div className="stack" style={{ gap: '1.25rem', marginTop: '1.25rem' }}>
                {isGuest ? (
                  <div className="enter-field">
                    <label className="enter-label" htmlFor="nick">
                      Nickname
                    </label>
                    <div className="enter-nick">
                      <span className="enter-nick-glyph" aria-hidden="true" translate="no">
                        {iconFor(avatar)}
                      </span>
                      <input
                        id="nick"
                        className="enter-input"
                        name="nickname"
                        autoComplete="nickname"
                        autoFocus
                        spellCheck={false}
                        maxLength={24}
                        required
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder="Rim-07"
                        aria-describedby="nick-hint"
                      />
                    </div>
                    <p id="nick-hint" className="enter-hint">
                      {nickname.length}/24
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="enter-field">
                      <label className="enter-label" htmlFor="handle">
                        Pseudonym
                      </label>
                      <input
                        id="handle"
                        className="enter-input"
                        name="username"
                        autoComplete="username"
                        autoFocus
                        spellCheck={false}
                        autoCapitalize="none"
                        maxLength={20}
                        required
                        value={handle}
                        onChange={(e) => setHandle(e.target.value)}
                        placeholder="rim-07"
                        aria-describedby="handle-hint"
                        aria-invalid={handleProblem !== null}
                      />
                      <p id="handle-hint" className={`enter-hint${handleProblem ? ' is-bad' : ''}`}>
                        {handleProblem ?? 'Lowercase, how peers find you.'}
                      </p>
                    </div>

                    <div className="enter-field">
                      <label className="enter-label" htmlFor="secret">
                        Passphrase
                      </label>
                      <div className="enter-secret">
                        <input
                          id="secret"
                          className="enter-input"
                          name={isSignup ? 'new-password' : 'current-password'}
                          type={showSecret ? 'text' : 'password'}
                          autoComplete={isSignup ? 'new-password' : 'current-password'}
                          maxLength={PASSPHRASE_MAX}
                          required
                          value={passphrase}
                          onChange={(e) => setPassphrase(e.target.value)}
                          aria-describedby="secret-hint"
                          aria-invalid={secretProblem !== null}
                        />
                        <button
                          type="button"
                          className="enter-reveal"
                          aria-label={showSecret ? 'Hide passphrase' : 'Show passphrase'}
                          aria-pressed={showSecret}
                          onClick={() => setShowSecret((v) => !v)}
                        >
                          {showSecret ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      <p id="secret-hint" className={`enter-hint${secretProblem ? ' is-bad' : ''}`}>
                        {secretProblem ?? `${PASSPHRASE_MIN} characters minimum.`}
                      </p>
                    </div>
                  </>
                )}

                <fieldset className="enter-field">
                  <legend className="enter-label">Avatar</legend>
                  <div className="enter-avatars" role="radiogroup" aria-label="Avatar" translate="no">
                    {AVATARS.map((a) => (
                      <label key={a} className={`enter-avatar${avatar === a ? ' is-on' : ''}`}>
                        <input type="radio" name="avatar" value={a} checked={avatar === a} onChange={() => setAvatar(a)} />
                        <span aria-hidden="true">{iconFor(a)}</span>
                        <span className="visually-hidden">{a}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="enter-field">
                  <legend className="enter-label">Where will you learn?</legend>
                  <div className="enter-contexts" role="radiogroup" aria-label="Context" translate="no">
                    {CONTEXTS.map((c) => (
                      <label key={c.id} className={`enter-context${context === c.id ? ' is-on' : ''}`}>
                        <input type="radio" name="context" value={c.id} checked={context === c.id} onChange={() => setContext(c.id)} />
                        {c.label}
                        <span className="visually-hidden"> — {c.desc}</span>
                      </label>
                    ))}
                  </div>
                  <p className="enter-hint">{CONTEXTS.find((c) => c.id === context)?.desc}</p>
                </fieldset>

                {err && <ErrorNote code={err.code} msg={err.msg} retryable={err.retryable} onRetry={() => setErr(null)} />}

                <button type="submit" className="enter-submit" disabled={!canSubmit}>
                  {busy
                    ? isGuest
                      ? 'Stepping in…'
                      : isSignup
                        ? 'Claiming…'
                        : 'Signing in…'
                    : isGuest
                      ? 'Continue as guest'
                      : isSignup
                        ? 'Create account'
                        : 'Sign in'}
                </button>

                <p className="enter-hint" style={{ textAlign: 'center' }}>
                  No email. No phone. {isSignup ? 'Just a pseudonym and a passphrase.' : 'Accounts stay pseudonymous by design.'}
                </p>
              </div>
            </form>
          </motion.div>

          <motion.p variants={softReveal} className="enter-foot">
            <Link to="/circles/join">Have a join code?</Link>
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
