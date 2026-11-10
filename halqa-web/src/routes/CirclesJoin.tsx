import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiFailure, api } from '../lib/api';
import { useSession } from '../lib/session';
import { ErrorNote } from '../components/ui';

export function CirclesJoin() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { lang, setCircleId, login } = useSession();
  const [code, setCode] = useState((params.get('code') ?? '').toUpperCase());
  const [nick, setNick] = useState('');
  const [preview, setPreview] = useState<{ circleId: string; topic: string; members: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lookup = async () => {
    setErr(null);
    setPreview(null);
    try {
      const r = await api.circleByCode(code.trim());
      setPreview(r.data);
    } catch (e) {
      const f = e as ApiFailure;
      setErr(f.body?.user_msg?.[lang] ?? 'Unknown code — check with the host.');
    }
  };

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const id = preview?.circleId ?? code.trim();
      const r = await api.circleJoin(id, nick.trim());
      sessionStorage.setItem('halqa.nick', nick.trim());
      login(r.token, r.learnerId);
      setCircleId(id);
      nav(`/c/${id}`);
    } catch (e) {
      const f = e as ApiFailure;
      setErr(f.body?.user_msg?.[lang] ?? 'Join failed — check the code.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page narrow">
      <h1>Join a circle</h1>
      <form onSubmit={join} className="stack">
        <div className="field">
          <label htmlFor="code">6-letter circle code</label>
          <div className="row">
            <input
              id="code"
              name="circle-code"
              required
              spellCheck={false}
              autoComplete="off"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase().replace(/\s+/g, ''));
                setPreview(null);
              }}
              onBlur={lookup}
              placeholder="e.g. KQ7X2P"
              maxLength={6}
              translate="no"
            />
            <button type="button" className="btn btn-ghost btn-small" onClick={lookup} disabled={code.trim().length < 4}>
              Check
            </button>
          </div>
          {preview && (
            <span className="hint ok" aria-live="polite">
              ✓ <span translate="no">{preview.topic}</span> · {preview.members} member{preview.members === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <div className="field">
          <label htmlFor="jnick">Your nickname</label>
          <input id="jnick" name="nickname" maxLength={24} required spellCheck={false} autoComplete="nickname" value={nick} onChange={(e) => setNick(e.target.value)} placeholder="e.g. Peer-Yassine…" />
        </div>
        {err && <ErrorNote code="JOIN_FAILED" msg={err} retryable onRetry={() => setErr(null)} />}
        <button type="submit" className="btn" disabled={busy || !nick.trim() || (!preview && code.trim().length < 4)}>
          {busy ? 'Joining…' : 'Join →'}
        </button>
      </form>
    </div>
  );
}
