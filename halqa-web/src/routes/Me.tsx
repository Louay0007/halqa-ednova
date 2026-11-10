import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { PassportView } from './Dna';

export function Me() {
  const { learnerId, logout } = useSession();
  const [data, setData] = useState<{ learner: { nickname?: string; avatarKey?: string }; passport: Record<string, unknown> | null } | null>(null);
  const [xp, setXp] = useState<{ total: number; badges: string[] } | null>(null);

  useEffect(() => {
    api
      .me()
      .then((r) => setData(r.data as { learner: { nickname?: string; avatarKey?: string }; passport: Record<string, unknown> | null }))
      .catch(() => undefined);
    if (learnerId)
      api
        .xp(learnerId)
        .then((r) => setXp(r.data))
        .catch(() => undefined);
  }, [learnerId]);

  if (!data) return <div className="page narrow"><div className="skel" style={{ height: 120 }} /></div>;
  return (
    <div className="page narrow">
      <h1>
        Passport — <span translate="no">{data.learner.nickname ?? learnerId}</span>
      </h1>
      {data.passport ? <PassportView p={data.passport} /> : <p className="muted">No passport yet — run the DNA.</p>}
      {xp && (
        <p className="tnum">
          XP {xp.total} · badges: {xp.badges.join(', ') || '—'}
        </p>
      )}
      <button type="button" className="btn btn-ghost btn-small" onClick={logout}>
        Log out (token dies with this tab)
      </button>
    </div>
  );
}
