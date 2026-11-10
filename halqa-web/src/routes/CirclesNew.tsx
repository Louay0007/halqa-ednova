import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ApiFailure, api, type ContextMode, type Lang } from '../lib/api';
import { useSession } from '../lib/session';
import { ErrorNote } from '../components/ui';

export function CirclesNew() {
  const nav = useNavigate();
  const { lang, setCircleId, setSessionId } = useSession();
  const [topic, setTopic] = useState('binary_search');
  const [context, setContext] = useState<ContextMode>('study');
  const [circleLang, setCircleLang] = useState<Lang>('darija');
  const [windowS, setWindowS] = useState(45);
  const [nick, setNick] = useState('');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ circleId: string; joinCode: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .kbStats()
      .then(() => api.kbChunks('binary_search').then((r) => {
        const c: Record<string, number> = {};
        for (const ch of r.data.chunks) c[ch.lang] = (c[ch.lang] ?? 0) + 1;
        setCounts(c);
      }))
      .catch(() => undefined);
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const r = await api.circleCreate({ topic, context, lang: circleLang, windowS, hostNickname: nick.trim() });
      sessionStorage.setItem('halqa.nick', nick.trim());
      setCircleId(r.circleId);
      setSessionId('');
      setResult({ circleId: r.circleId, joinCode: r.joinCode });
    } catch (e) {
      const f = e as ApiFailure;
      setErr(f.body?.user_msg?.[lang] ?? 'Create failed.');
    }
  };

  if (result) {
    const url = `${location.origin}/circles/join?code=${result.joinCode}`;
    return (
      <div className="page narrow">
        <h1>Circle ready — share the code</h1>
        <div className="card code-big" aria-live="polite">
          <div className="code tnum" translate="no">
            {result.joinCode}
          </div>
          <p className="muted">Peers: camera → join, or type the code.</p>
          <p className="muted" translate="no">
            {url}
          </p>
          <QRCodeSVG value={url} size={160} role="img" aria-label={`Join code QR for ${result.joinCode}`} />
          <div className="cta-row">
            <button type="button" className="btn" onClick={() => navigator.clipboard?.writeText(result.joinCode).catch(() => undefined)}>
              Copy code
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => nav(`/c/${result.circleId}`)}>
              Open lobby →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page narrow">
      <h1>New circle</h1>
      <form onSubmit={create} className="stack">
        <div className="field">
          <label htmlFor="topic">Topic</label>
          <select id="topic" value={topic} onChange={(e) => setTopic(e.target.value)}>
            <option value="binary_search">binary_search {counts.en ? `(${Object.values(counts).reduce((a, b) => a + b, 0)} chunks)` : ''}</option>
            <option value="fractions">fractions</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="ctx">Context</label>
          <select id="ctx" value={context} onChange={(e) => setContext(e.target.value as ContextMode)}>
            {(['class', 'study', 'community', 'workshop', 'program', 'solo'] as const).map((c) => (
              <option key={c} value={c} translate="no">
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="clang">Circle language</label>
          <select id="clang" value={circleLang} onChange={(e) => setCircleLang(e.target.value as Lang)}>
            {(['fr', 'darija', 'ar', 'en'] as const).map((l) => (
              <option key={l} value={l} translate="no">
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="win">
            Peer window: <span className="tnum">{windowS}s</span>
          </label>
          <input id="win" type="range" min={30} max={90} step={5} value={windowS} onChange={(e) => setWindowS(Number(e.target.value))} />
        </div>
        <div className="field">
          <label htmlFor="host">Your nickname</label>
          <input id="host" name="nickname" maxLength={24} required spellCheck={false} autoComplete="nickname" value={nick} onChange={(e) => setNick(e.target.value)} placeholder="e.g. Host-Rim…" />
        </div>
        {err && <ErrorNote code="CIRCLE_CREATE" msg={err} retryable onRetry={() => setErr(null)} />}
        <button type="submit" className="btn" disabled={nick.trim().length === 0}>
          Create circle →
        </button>
        <p>
          <Link to="/circles/join">Have a code? Join instead →</Link>
        </p>
      </form>
    </div>
  );
}
