import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiFailure, api } from '../lib/api';
import { useSession } from '../lib/session';
import { ErrorNote } from '../components/ui';

export function Lobby() {
  const { circleId = '' } = useParams();
  const nav = useNavigate();
  const { lang, setCircleId, setSessionId } = useSession();
  const [circle, setCircle] = useState<{ topic: string; members: Array<{ learnerId: string; role: string; nickname?: string }>; joinCode: string; windowS: number } | null>(null);
  const [cards, setCards] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setCircleId(circleId);
    api
      .circleGet(circleId)
      .then(async (r) => {
        setCircle(r.data);
        const next: Record<string, string> = {};
        for (const m of r.data.members) {
          try {
            const c = await api.explainCard(m.learnerId);
            if (c.data.visible) next[m.learnerId] = c.data.card;
          } catch {
            /* opt-in: hidden cards stay hidden */
          }
        }
        setCards(next);
      })
      .catch((e: ApiFailure) => setErr(e.body?.user_msg?.[lang] ?? 'Lobby failed to load.'));
  }, [circleId, lang, setCircleId]);

  const start = async () => {
    try {
      const r = await api.sessionStart(circleId);
      setSessionId(r.sessionId);
      nav(`/c/${circleId}/s/${r.sessionId}`);
    } catch (e) {
      const f = e as ApiFailure;
      setErr(f.body?.user_msg?.[lang] ?? 'Could not start the session.');
    }
  };

  if (err) return <div className="page narrow"><ErrorNote code="LOBBY" msg={err} retryable onRetry={() => location.reload()} /></div>;
  if (!circle) return <div className="page narrow"><div className="skel" style={{ height: 120 }} /><div className="skel" style={{ height: 80 }} /></div>;

  return (
    <div className="page">
      <h1 translate="no">{circle.topic} circle</h1>
      <p className="muted">
        Code <strong className="tnum" translate="no">{circle.joinCode}</strong> · window <strong className="tnum">{circle.windowS}s</strong>
      </p>
      <section aria-label="Members">
        <h2>Members ({circle.members.length})</h2>
        <ul className="members">
          {circle.members.map((m) => (
            <li key={m.learnerId} className="card member">
              <strong translate="no">{m.nickname ?? m.learnerId}</strong>
              <span className="muted" translate="no">{m.role}</span>
              {cards[m.learnerId] && <small className="explain">{cards[m.learnerId]}</small>}
            </li>
          ))}
        </ul>
      </section>
      <button type="button" className="btn" onClick={start}>
        Start session →
      </button>
    </div>
  );
}
