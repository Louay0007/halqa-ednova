import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { SbuRings } from '../components/ui';
import { Reveal } from '../lib/motion';
import { t } from '../lib/i18n';

interface DashData {
  sessions: Array<{
    sessionId: string;
    health: { S: number; B: number; U: number; needsHuman: boolean } | null;
    talkShare: Array<{ learnerId: string; total: number }>;
    stuck: boolean;
  }>;
  styleMix: Record<string, number>;
  aggregatesOnly: boolean;
}

export function Dashboard() {
  const { lang } = useSession();
  const [data, setData] = useState<DashData | null>(null);

  useEffect(() => {
    api.dashboard().then((r) => setData(r.data as DashData)).catch(() => undefined);
  }, []);

  if (!data) return <div className="page"><div className="skel" style={{ height: 140 }} /></div>;
  const stuckFirst = [...data.sessions].sort((a, b) => Number(b.stuck) - Number(a.stuck));
  const styleTotal = Math.max(1, ...Object.values(data.styleMix));
  const styleColors = ['var(--aqua)', 'var(--plum)', 'var(--gold)', 'var(--green)'];

  return (
    <div className="page dashboard">
      <Reveal as="header" className="duo-head" index={0}>
        <h1>{t('dash_title', lang)}</h1>
        <p className="muted">{t('dash_sub', lang)}</p>
      </Reveal>

      <Reveal as="section" className="card" index={1}>
        <h2>{t('stuck_first', lang)}</h2>
        {stuckFirst.length === 0 && <p className="muted">{t('dash_empty', lang)}</p>}
        <div className="dash-sessions">
          {stuckFirst.map((s, i) => {
            const max = Math.max(1, ...s.talkShare.map((t) => t.total));
            return (
              <article key={s.sessionId} className={`card dash-session${s.stuck ? ' needs-human' : ''}`}>
                <div className="dash-session-head">
                  <strong translate="no">{s.sessionId}</strong>
                  {s.stuck && <span className="stuck-badge">{t('stuck', lang)}</span>}
                </div>
                {s.health && <SbuRings S={s.health.S} B={s.health.B} U={s.health.U} />}
                <ul className="talk">
                  {s.talkShare.map((t) => (
                    <li key={t.learnerId}>
                      <span translate="no">{t.learnerId}</span>
                      <span className="bar" aria-hidden="true"><i style={{ width: `${(t.total / max) * 100}%` }} /></span>
                      <span className="tnum">{t.total}</span>
                    </li>
                  ))}
                </ul>
                <span className="hint">{t('aggregates_only', lang)}</span>
                <span className="visually-hidden">session index {i}</span>
              </article>
            );
          })}
        </div>
      </Reveal>

      <Reveal as="section" className="card" index={2}>
        <h2>{t('style_mix', lang)}</h2>
        <div className="style-bar" role="img" aria-label={t('style_mix', lang)}>
          {Object.entries(data.styleMix).map(([k, v], i) => (
            <span key={k} className="style-seg" style={{ width: `${(v / styleTotal) * 100}%`, background: styleColors[i % styleColors.length] }} title={`${k}: ${v}`} />
          ))}
        </div>
        <ul className="style-legend">
          {Object.entries(data.styleMix).map(([k, v], i) => (
            <li key={k}>
              <span className="style-swatch" style={{ background: styleColors[i % styleColors.length] }} aria-hidden="true" />
              <span translate="no">{k}</span> <span className="tnum">{v}</span>
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal as="section" className="card" index={3}>
        <h2>{t('sbu_trends', lang)}</h2>
        <ul className="trends">
          {stuckFirst.map((s) => (
            <li key={s.sessionId}>
              <span translate="no">{s.sessionId}</span>
              <span className="trend-bars" aria-hidden="true">
                {[s.health?.S ?? 0, s.health?.B ?? 0, s.health?.U ?? 0].map((v, j) => (
                  <span key={j} className="trend-track"><i style={{ width: `${v * 100}%` }} /></span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </Reveal>
    </div>
  );
}
