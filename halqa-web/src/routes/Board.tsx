import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { SbuRings } from '../components/ui';

export function Board() {
  const [nicks, setNicks] = useState('');
  const [groups, setGroups] = useState<Array<{ circleId: string; learnerIds: string[]; rationale: string }>>([]);
  const [circles, setCircles] = useState<Array<{ id: string; topic: string; S?: number; B?: number; U?: number; needsHuman?: boolean; noSession?: boolean }>>([]);

  const load = () => {
    api
      .board()
      .then((r) => setCircles(r.data.circles))
      .catch(() => undefined);
  };
  useEffect(() => {
    load();
    const id = setInterval(() => !document.hidden && load(), 5000);
    return () => clearInterval(id);
  }, []);

  const match = async (e: React.FormEvent) => {
    e.preventDefault();
    const list = nicks.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    if (!list.length) return;
    const r = await api.match(list, 2026).catch(() => null);
    if (r) setGroups(r.groups);
  };

  return (
    <div className="page">
      <h1>Workshop board</h1>
      <form onSubmit={match} className="card stack">
        <label htmlFor="nicks">Nicknames (one per line) → matched circles of 3–5</label>
        <textarea id="nicks" rows={4} value={nicks} onChange={(e) => setNicks(e.target.value)} placeholder={'Rim\nAhmed\nNour…'} />
        <button type="submit" className="btn">
          Match circles
        </button>
        {groups.map((g) => (
          <p key={g.circleId} className="muted">
            <strong translate="no">{g.circleId}</strong>: <span translate="no">{g.learnerIds.join(', ')}</span> — {g.rationale}
          </p>
        ))}
      </form>
      <section className="grid" aria-label="Circles">
        {circles.map((c) => (
          <article key={c.id} className={`card${c.needsHuman ? ' needs-human' : ''}`}>
            <h2 translate="no">{c.id}</h2>
            <p className="muted" translate="no">
              {c.topic}
            </p>
            {c.noSession ? (
              <span className="muted">no session yet</span>
            ) : (
              <>
                <SbuRings S={c.S ?? 0} B={c.B ?? 0.5} U={c.U ?? 0.5} />
                {c.needsHuman && (
                  <p className="needs-human">
                    <Link to={`/mentor?circleId=${c.id}`}>Needs a human now →</Link>
                  </p>
                )}
              </>
            )}
          </article>
        ))}
        {circles.length === 0 && <p className="muted">No circles yet.</p>}
      </section>
    </div>
  );
}
