import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { SbuRings } from '../components/ui';

export function Dashboard() {
  const [data, setData] = useState<{ sessions: Array<{ sessionId: string; health: { S: number; B: number; U: number; needsHuman: boolean } | null; talkShare: Array<{ learnerId: string; total: number }>; stuck: boolean }>; styleMix: Record<string, number>; aggregatesOnly: boolean } | null>(null);

  useEffect(() => {
    api
      .dashboard()
      .then((r) => setData(r.data))
      .catch(() => undefined);
  }, []);

  if (!data) return <div className="page"><div className="skel" style={{ height: 140 }} /></div>;
  const stuckFirst = [...data.sessions].sort((a, b) => Number(b.stuck) - Number(a.stuck));

  return (
    <div className="page">
      <h1>Teacher dashboard</h1>
      <p className="muted">Aggregates only — no per-child surveillance.</p>
      <section aria-label="Sessions, stuck first">
        <h2>Stuck concepts first</h2>
        {stuckFirst.map((s) => (
          <article key={s.sessionId} className={`card${s.stuck ? ' needs-human' : ''}`}>
            <h3 translate="no">{s.sessionId}</h3>
            {s.health && <SbuRings S={s.health.S} B={s.health.B} U={s.health.U} />}
            <ul className="talk">
              {s.talkShare.map((t) => (
                <li key={t.learnerId}>
                  <span translate="no">{t.learnerId}</span> <span className="tnum">{t.total}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
        {stuckFirst.length === 0 && <p className="muted">No sessions yet.</p>}
      </section>
      <section className="card" aria-label="Style mix">
        <h2>Style mix</h2>
        <ul>
          {Object.entries(data.styleMix).map(([k, v]) => (
            <li key={k}>
              <span translate="no">{k}</span> <span className="tnum">{v}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
