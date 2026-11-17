import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { iconFor } from '../lib/avatars';
import { PassportView } from './Dna';

interface MeData {
  learner: { id?: string; nickname?: string; avatarKey?: string; context?: string };
  passport: Record<string, unknown> | null;
}

export function Me() {
  const { learnerId, logout } = useSession();
  const nav = useNavigate();
  const [data, setData] = useState<MeData | null>(null);
  const [xp, setXp] = useState<{ total: number; badges: string[] } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .me()
      .then((r) => setData(r.data as MeData))
      .catch(() => undefined);
    if (learnerId)
      api
        .xp(learnerId)
        .then((r) => setXp(r.data))
        .catch(() => undefined);
  }, [learnerId]);

  const signOut = () => {
    setBusy(true);
    // Revoke server-side (epoch bump) before dropping the local token, so a
    // copied token cannot outlive the sign-out.
    api
      .signout()
      .catch(() => undefined)
      .finally(() => {
        logout();
        nav('/enter', { replace: true });
      });
  };

  if (!data) {
    return (
      <div className="page narrow auth">
        <div className="skel" style={{ height: 96 }} />
      </div>
    );
  }

  const nick = data.learner.nickname ?? learnerId;

  return (
    <div className="page narrow auth">
      <header className="auth-head">
        <h1>Passport</h1>
        <p className="auth-lede">Your learner record on this device.</p>
      </header>

      <section className="auth-card">
        <div className="identity">
          <span className="identity-glyph" aria-hidden="true" translate="no">
            {iconFor(data.learner.avatarKey)}
          </span>
          <div className="identity-text">
            <h2 translate="no">{nick}</h2>
            <span className="hint tnum" translate="no">
              {learnerId}
            </span>
          </div>
        </div>

        {data.passport ? (
          <PassportView p={data.passport} />
        ) : (
          <p className="muted">No passport yet — run the DNA.</p>
        )}

        {xp && (
          <p className="hint tnum">
            XP {xp.total} · badges {xp.badges.join(', ') || '—'}
          </p>
        )}
      </section>

      <footer className="auth-foot">
        <button type="button" className="btn btn-ghost btn-small" onClick={signOut} disabled={busy}>
          {busy ? 'Signing out…' : 'Sign out'}
        </button>
        <span className="hint">Revokes this device token.</span>
      </footer>
    </div>
  );
}
