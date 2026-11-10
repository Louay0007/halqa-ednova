import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiFailure, api, type ContextMode } from '../lib/api';
import { useSession } from '../lib/session';
import { ErrorNote } from '../components/ui';
import { t } from '../lib/i18n';

const AVATARS = ['fox', 'owl', 'star', 'deer', 'wave', 'palm', 'moon', 'key'] as const;
const CONTEXTS: Array<{ id: ContextMode; desc: string }> = [
  { id: 'class', desc: 'Teacher-led lesson' },
  { id: 'study', desc: 'Revision circle with friends' },
  { id: 'community', desc: 'Low-bandwidth friendly' },
  { id: 'workshop', desc: 'Matched groups + mentor board' },
  { id: 'program', desc: 'Repeated sessions, spaced review' },
  { id: 'solo', desc: 'Just you + Nova' },
];

export function Enter() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { lang, login } = useSession();
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState<string>(() => AVATARS[Math.floor(Math.random() * AVATARS.length)]);
  const [context, setContext] = useState<ContextMode>((params.get('context') as ContextMode) || 'study');
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
      nav(context === 'solo' ? '/dna?next=/solo' : '/dna?next=/circles/join');
    } catch (e) {
      const f = e as ApiFailure;
      setErr({ code: f.body?.code ?? 'ENTER_FAILED', msg: f.body?.user_msg?.[lang] ?? 'Could not enter — retry.', retryable: f.body?.retryable ?? true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page narrow">
      <h1>Enter — no signup, under a minute</h1>
      <form onSubmit={submit} className="stack">
        <div className="field">
          <label htmlFor="nick">Nickname</label>
          <input
            id="nick"
            name="nickname"
            autoComplete="nickname"
            spellCheck={false}
            maxLength={24}
            required
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="e.g. Rim-07…"
          />
          <span className="hint tnum">{nickname.length}/24 · anonymous, nothing personal</span>
        </div>
        <fieldset className="field">
          <legend>Avatar (neutral icons only)</legend>
          <div className="avatar-grid" role="radiogroup" aria-label="Avatar">
            {AVATARS.map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={avatar === a}
                aria-pressed={avatar === a}
                className={`avatar${avatar === a ? ' avatar-on' : ''}`}
                onClick={() => setAvatar(a)}
              >
                <span aria-hidden="true">{iconFor(a)}</span>
                <span className="visually-hidden">{a}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="field">
          <legend>Context</legend>
          <div className="ctx-grid">
            {CONTEXTS.map((c) => (
              <button key={c.id} type="button" aria-pressed={context === c.id} className={`ctx${context === c.id ? ' ctx-on' : ''}`} onClick={() => setContext(c.id)}>
                <strong translate="no">{c.id}</strong>
                <small>{c.desc}</small>
              </button>
            ))}
          </div>
        </fieldset>
        {err && <ErrorNote code={err.code} msg={err.msg} retryable={err.retryable} onRetry={() => setErr(null)} />}
        <button type="submit" className="btn" disabled={busy || nickname.trim().length === 0}>
          {busy ? `${t('ask', lang)}…` : 'Enter →'}
        </button>
      </form>
    </div>
  );
}

function iconFor(a: string): string {
  return { fox: '🦊', owl: '🦉', star: '⭐', deer: '🦌', wave: '🌊', palm: '🌴', moon: '🌙', key: '🔑' }[a] ?? '⭐';
}
