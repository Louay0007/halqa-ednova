import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiFailure, api } from '../lib/api';
import { useSession } from '../lib/session';
import { ErrorNote, SbuRings } from '../components/ui';
import { Reveal } from '../lib/motion';
import { styleLabel, t } from '../lib/i18n';

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
  const { lang, circleId } = useSession();
  const [data, setData] = useState<DashData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  /** Separates "the server refused this account" from "the request failed".
   *  Only the second is worth a Retry button. */
  const [forbidden, setForbidden] = useState(false);
  /** learnerId → nickname, from the circle we are already a member of. The
   *  dashboard endpoint only returns ids, and ids are not something a mentor
   *  should have to read. */
  const [names, setNames] = useState<Record<string, string>>({});

  /** `loading` starts true and is only cleared by the fetch that the effect or
   *  the retry button started — nothing sets it synchronously inside an effect,
   *  which would trip react(set-state-in-effect) and cause a double render. */
  const load = useCallback(
    () =>
      api
        .dashboard(circleId || undefined)
        .then((r) => setData(r.data as DashData))
        .catch((e: ApiFailure) => {
          // 403 is @Roles('mentor','admin') and cannot change on retry.
          if (e.status === 403) setForbidden(true);
          else setErr(e.body?.user_msg?.[lang] ?? t('load_failed', lang));
        })
        .finally(() => setLoading(false)),
    [circleId, lang],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const retry = () => {
    setErr(null);
    setForbidden(false);
    setLoading(true);
    void load();
  };

  useEffect(() => {
    if (!circleId) return;
    let live = true;
    api
      .circleGet(circleId)
      .then((r) => {
        if (!live) return;
        const m: Record<string, string> = {};
        for (const mem of r.data.members) if (mem.nickname) m[mem.learnerId] = mem.nickname;
        setNames(m);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [circleId]);

  const who = (id: string) => names[id] ?? id;

  if (loading && !data) return <div className="page"><div className="skel" style={{ height: 140 }} /></div>;

  if (forbidden) {
    return (
      <div className="page dashboard">
        <Reveal as="header" className="duo-head" index={0}>
          <h1>{t('dash_forbidden_title', lang)}</h1>
          <p className="muted">{t('dash_forbidden_body', lang)}</p>
        </Reveal>
        <Link className="btn" style={{ minHeight: 44 }} to="/me">
          {t('go_to_me', lang)}
        </Link>
      </div>
    );
  }

  if (err && !data) {
    return (
      <div className="page dashboard">
        <div className="duo-head">
          <h1>{t('dash_title', lang)}</h1>
          <p className="muted">{t('dash_sub', lang)}</p>
        </div>
        <ErrorNote code="DASHBOARD" msg={err} retryable onRetry={retry} />
      </div>
    );
  }

  if (!data) return null;

  const stuckFirst = [...data.sessions].sort((a, b) => Number(b.stuck) - Number(a.stuck));
  const styleTotal = Math.max(1, ...Object.values(data.styleMix));
  const styleColors = ['var(--aqua)', 'var(--plum)', 'var(--gold)', 'var(--green)'];

  return (
    <div className="page dashboard">
      <Reveal as="header" className="duo-head" index={0}>
        <h1>{t('dash_title', lang)}</h1>
        <p className="muted">{t('dash_sub', lang)}</p>
      </Reveal>

      {err && (
        <ErrorNote code="DASHBOARD" msg={err} retryable onRetry={retry} />
      )}

      <Reveal as="section" className="card" index={1}>
        <h2>{t('stuck_first', lang)}</h2>
        {stuckFirst.length === 0 && <p className="muted">{t('dash_empty', lang)}</p>}
        <div className="dash-sessions">
          {stuckFirst.map((s, si) => {
            const max = Math.max(1, ...s.talkShare.map((x) => x.total));
            return (
              <article key={s.sessionId} className={`card dash-session${s.stuck ? ' needs-human' : ''}`}>
                <div className="dash-session-head">
                  {/* A mentor scans this page for "which session", not for an ObjectId.
                      The id stays beside it because it is what you paste into /mentor. */}
                  <strong>{t('session_n', lang, { n: si + 1 })}</strong>
                  <span className="hint tnum" translate="no">{s.sessionId}</span>
                  {s.stuck && <span className="stuck-badge">{t('stuck', lang)}</span>}
                </div>
                {s.health && <SbuRings S={s.health.S} B={s.health.B} U={s.health.U} />}
                {data.aggregatesOnly ? (
                  <p className="hint">{t('dashboard_private', lang)}</p>
                ) : (
                  <ul className="talk">
                    {s.talkShare.map((x) => (
                      <li key={x.learnerId}>
                        <span translate="no">{who(x.learnerId)}</span>
                        <span className="bar" aria-hidden="true"><i style={{ width: `${(x.total / max) * 100}%` }} /></span>
                        <span className="tnum">{x.total}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      </Reveal>

      <Reveal as="section" className="card" index={2}>
        <h2>{t('style_mix', lang)}</h2>
        <div className="style-bar" role="img" aria-label={t('style_mix', lang)}>
          {Object.entries(data.styleMix).map(([k, v], i) => (
            <span key={k} className="style-seg" style={{ width: `${(v / styleTotal) * 100}%`, background: styleColors[i % styleColors.length] }} title={`${styleLabel(k, lang)}: ${v}`} />
          ))}
        </div>
        <ul className="style-legend">
          {Object.entries(data.styleMix).map(([k, v], i) => (
            <li key={k}>
              <span className="style-swatch" style={{ background: styleColors[i % styleColors.length] }} aria-hidden="true" />
              <span>{styleLabel(k, lang)}</span> <span className="tnum">{v}</span>
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal as="section" className="card" index={3}>
        <h2>{t('sbu_trends', lang)}</h2>
        <ul className="trends">
          {stuckFirst.map((s, si) => (
            <li key={s.sessionId}>
              <span>{t('session_n', lang, { n: si + 1 })}</span>
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
