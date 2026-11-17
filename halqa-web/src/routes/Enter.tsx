import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiFailure, api, type ContextMode } from '../lib/api';
import { useSession } from '../lib/session';
import { ErrorNote } from '../components/ui';
import { t } from '../lib/i18n';
import { AVATARS, iconFor } from '../lib/avatars';

const CONTEXTS: Array<{ id: ContextMode; label: string; desc: string }> = [
  { id: 'class', label: 'Class', desc: 'Teacher-led lesson' },
  { id: 'study', label: 'Study', desc: 'Revision circle with friends' },
  { id: 'community', label: 'Community', desc: 'Low-bandwidth friendly' },
  { id: 'workshop', label: 'Workshop', desc: 'Matched groups + mentor board' },
  { id: 'program', label: 'Program', desc: 'Repeated sessions, spaced review' },
  { id: 'solo', label: 'Solo', desc: 'Just you + Nova' },
];

export function Enter() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { lang, login } = useSession();
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState<string>(() => AVATARS[Math.floor(Math.random() * AVATARS.length)]);
  const [context, setContext] = useState<ContextMode>(() => {
    const preset = params.get('context') as ContextMode | null;
    return CONTEXTS.some((c) => c.id === preset) ? (preset as ContextMode) : 'study';
  });
  const [err, setErr] = useState<{ code: string; msg: string; retryable: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api.authSession(nickname.trim(), context, avatar);
      sessionStorage.setItem('halqa.nick', nickname.trim());
      login(r.token, r.learner.id);
      // Resume wherever the guard bounced them from, else finish onboarding.
      const next = params.get('next');
      nav(next ? `/dna?next=${encodeURIComponent(next)}` : context === 'solo' ? '/dna?next=/solo' : '/dna?next=/circles/join');
    } catch (e) {
      const f = e as ApiFailure;
      setErr({ code: f.body?.code ?? 'ENTER_FAILED', msg: f.body?.user_msg?.[lang] ?? 'Could not enter — retry.', retryable: f.body?.retryable ?? true });
    } finally {
      setBusy(false);
    }
  };

  const picked = CONTEXTS.find((c) => c.id === context);

  return (
    <div className="page narrow auth">
      <header className="auth-head">
        <h1>Enter</h1>
        <p className="auth-lede">A nickname and a token. No password, nothing personal.</p>
      </header>

      <form onSubmit={submit} className="auth-card">
        <div className="field">
          <label htmlFor="nick">Nickname</label>
          <div className="nick-row">
            <span className="nick-glyph" aria-hidden="true" translate="no">
              {iconFor(avatar)}
            </span>
            <input
              id="nick"
              name="nickname"
              autoComplete="nickname"
              spellCheck={false}
              maxLength={24}
              required
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Rim-07"
              aria-describedby="nick-hint"
            />
          </div>
          <span className="hint tnum" id="nick-hint">
            {nickname.length}/24
          </span>
        </div>

        <fieldset className="field">
          <legend>Avatar</legend>
          <div className="avatars" role="radiogroup" aria-label="Avatar" translate="no">
            {AVATARS.map((a) => (
              <label key={a} className={`avatar-opt${avatar === a ? ' avatar-opt-on' : ''}`}>
                <input type="radio" name="avatar" value={a} checked={avatar === a} onChange={() => setAvatar(a)} />
                <span aria-hidden="true">{iconFor(a)}</span>
                <span className="visually-hidden">{a}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend>Context</legend>
          <div className="opt-row" role="radiogroup" aria-label="Context" translate="no">
            {CONTEXTS.map((c) => (
              <label key={c.id} className={`pill${context === c.id ? ' pill-on' : ''}`}>
                <input type="radio" name="context" value={c.id} checked={context === c.id} onChange={() => setContext(c.id)} />
                {c.label}
              </label>
            ))}
          </div>
          <span className="hint">{picked?.desc}</span>
        </fieldset>

        {err && <ErrorNote code={err.code} msg={err.msg} retryable={err.retryable} onRetry={() => setErr(null)} />}

        <button type="submit" className="btn btn-block" disabled={busy || nickname.trim().length === 0}>
          {busy ? `${t('ask', lang)}…` : 'Continue'}
        </button>
      </form>
    </div>
  );
}
