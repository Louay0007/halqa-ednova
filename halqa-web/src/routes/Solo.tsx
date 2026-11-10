import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ApiFailure, api, type Lang } from '../lib/api';
import { useSession } from '../lib/session';
import { ErrorNote, HatChip } from '../components/ui';

const HATS = ['NOVA_NOVICE', 'NOVA_SKEPTIC', 'NOVA_CURIOUS', 'NOVA_EXAMINER'] as const;

export function Solo() {
  const { lang, learnerId, metrics } = useSession();
  const [sid, setSid] = useState('');
  const [hat, setHat] = useState<string>('NOVA_NOVICE');
  const [probe, setProbe] = useState('');
  const [thread, setThread] = useState<Array<{ who: string; text: string }>>([]);
  const [text, setText] = useState('');
  const [progress, setProgress] = useState(0);
  const [invite, setInvite] = useState<{ deepLink: string; code: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const start = async () => {
    setErr(null);
    try {
      const r = await api.soloStart('binary_search', (lang as Lang) ?? 'darija', learnerId);
      setSid(r.sessionId);
      setHat(r.hat);
      setProbe(r.probe);
      setThread([{ who: r.hat, text: r.probe }]);
    } catch (e) {
      const f = e as ApiFailure;
      setErr(f.body?.user_msg?.[lang] ?? 'Solo failed to start.');
    }
  };

  const turn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const mine = text.trim();
    setText('');
    setThread((t) => [...t, { who: learnerId, text: mine }]);
    try {
      const r = await api.soloTurn(sid, learnerId, mine, lang);
      setThread((t) => [...t, { who: hat, text: r.novaTurn }]);
      setProgress(r.progress);
    } catch (e) {
      const f = e as ApiFailure;
      setErr(f.body?.user_msg?.[lang] ?? 'Turn failed.');
    }
  };

  const usage = metrics?.quotaUsage.find((u) => u.sessionId === sid);

  return (
    <div className="page narrow">
      <h1>Teach Nova — solo</h1>
      {!sid ? (
        <button type="button" className="btn" onClick={start} disabled={!learnerId}>
          {learnerId ? 'Start — Nova is the curious student' : 'Enter first, then come back →'}
        </button>
      ) : (
        <>
          <div className="hat-row" role="group" aria-label="Nova hat">
            {HATS.map((h) => (
              <button
                key={h}
                type="button"
                aria-pressed={hat === h}
                className={`hatchip${hat === h ? ' hatchip-on' : ''}`}
                onClick={() => api.soloHat(sid, h).then((r) => setHat(r.hat)).catch(() => undefined)}
                translate="no"
              >
                {h.replace('NOVA_', '')}
              </button>
            ))}
          </div>
          <div className="progress" role="progressbar" aria-valuenow={Math.round(progress * 8)} aria-valuemin={0} aria-valuemax={8}>
            <i style={{ width: `${progress * 100}%` }} />
          </div>
          <ol className="thread">
            {thread.map((m, i) => (
              <li key={i} className={m.who === learnerId ? 'me' : 'nova'}>
                {m.who !== learnerId && <HatChip hat={m.who} />}
                <p>{m.text}</p>
              </li>
            ))}
          </ol>
          {probe && thread.length === 1 && <p className="muted">Answer as the teacher — Nova learns from you.</p>}
          <form onSubmit={turn} className="row">
            <label className="visually-hidden" htmlFor="solo-text">
              Your explanation
            </label>
            <input id="solo-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Explain like a teacher…" />
            <button type="submit" className="btn btn-small" disabled={!text.trim()}>
              Send
            </button>
          </form>
          {usage && (
            <p className="muted tnum">
              Solo budget: {usage.cUsed}/8 compact · {usage.lUsed} larger (always 0)
            </p>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => api.soloInvite(sid).then((r) => setInvite(r)).catch(() => undefined)}
          >
            Invite a friend — make it a circle
          </button>
          {invite && (
            <div className="card stack">
              <p translate="no">
                {invite.deepLink} · code <strong>{invite.code}</strong>
              </p>
              <QRCodeSVG value={invite.deepLink} size={140} role="img" aria-label={`Invite QR, code ${invite.code}`} />
            </div>
          )}
        </>
      )}
      {err && <ErrorNote code="SOLO" msg={err} retryable onRetry={() => setErr(null)} />}
    </div>
  );
}
