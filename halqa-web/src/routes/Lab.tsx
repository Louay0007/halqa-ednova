import { useEffect, useState } from 'react';
import { api, type DegradationMode, type Metrics } from '../lib/api';
import { useSession } from '../lib/session';
import { Reveal } from '../lib/motion';
import { t } from '../lib/i18n';

const STEPS: Array<{ step: string; tier: string; why: string }> = [
  { step: 'group_pulse (intent·lang·safety·gate)', tier: 'C', why: 'bounded JSON, 1 call/turn shared by credits+confusion' },
  { step: 'retrieval (rewrite → top-5 + cites)', tier: 'T0', why: 'deterministic, zero quota' },
  { step: 'quick_take (≤60 words)', tier: 'C', why: 'single-source, hidden prep' },
  { step: 'deep_dive (≤150 words)', tier: 'L, escalation-gated', why: 'multi-source synthesis only; queued + fallback' },
  { step: 'hint L1–L3', tier: 'T0 templates', why: 'zero calls; L4 = quick take behind hintState≥3|skip gate' },
  { step: 'auditor (T0 screen + 1×C)', tier: 'C', why: 'bounded classify; poll-first on doubt' },
  { step: 'capsule draft → polish', tier: 'C → L iff quota', why: 'the one luxury call' },
  { step: 'whisper compare', tier: '≤1×C', why: 'checklist-bounded classify vs claim ids' },
  { step: 'mentor brief (≤60 words)', tier: '1×C on demand', why: 'extractive aggregation' },
  { step: 'solo turn (≤60 tokens)', tier: 'C, ≤8/session, 0 L', why: 'rephrase only; templates carry the pedagogy' },
];

const MODES: DegradationMode[] = ['green', 'orange', 'red', 'black'];

export function Lab() {
  const { sessionId, lang } = useSession();
  const [m, setM] = useState<Metrics | null>(null);
  const [mode, setMode] = useState<DegradationMode>('green');
  const [events, setEvents] = useState<Array<{ ts: string; actor: string; type: string; payload?: Record<string, unknown> }>>([]);
  const [replaying, setReplaying] = useState(false);

  const load = () => {
    api.metrics(sessionId || undefined).then((r) => setM(r.data)).catch(() => undefined);
    api.degradation().then((r) => setMode(r.data.mode)).catch(() => undefined);
    if (sessionId) api.events(sessionId, 60).then((r) => setEvents(r.data)).catch(() => undefined);
  };
  useEffect(() => {
    load();
    const id = setInterval(() => !document.hidden && load(), 3000);
    return () => clearInterval(id);
  }, [sessionId]);

  const force = async (md: DegradationMode) => {
    await api.chaos(md).catch(() => undefined);
    load();
  };

  const replay = async () => {
    setReplaying(true);
    for (const md of MODES) {
      await force(md);
      await new Promise((r) => setTimeout(r, 2200)); // filmable: each mode holds 2.2 s
    }
    await force('green');
    setReplaying(false);
  };

  return (
    <div className="page lab">
      <Reveal as="header" className="duo-head" index={0}>
        <h1>{t('lab_title', lang)}</h1>
        <p className="muted">{t('lab_sub', lang)}</p>
      </Reveal>

      <Reveal as="section" className="card route-table" index={1}>
        <h2>{t('route_table', lang)}</h2>
        <div className="table-scroll">
          <table className="rtable">
            <thead>
              <tr>
                <th>{t('step', lang)}</th>
                <th>{t('tier', lang)}</th>
                <th>{t('why', lang)}</th>
              </tr>
            </thead>
            <tbody>
              {STEPS.map((s) => (
                <tr key={s.step}>
                  <td translate="no">{s.step}</td>
                  <td><span className={`tier-chip tier-${s.tier[0]?.toLowerCase()}`} translate="no">{s.tier}</span></td>
                  <td>{s.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>

      <Reveal as="section" className="card lshare" index={2}>
        <h2>{t('l_share', lang)}</h2>
        <div className="lshare-big tnum">{m ? `${(m.lShare * 100).toFixed(1)}%` : '…'}</div>
        <div className="lshare-bar" role="meter" aria-valuenow={m ? Math.round(m.lShare * 100) : 0} aria-valuemin={0} aria-valuemax={100} aria-label={t('l_share', lang)}>
          <div className="lshare-fill" style={{ width: `${Math.min(100, (m?.lShare ?? 0) * 100 * 4)}%` }} />
          <div className="lshare-target" aria-hidden="true" />
          <span className="lshare-marker tnum" aria-hidden="true">25%</span>
        </div>
        <p className="hint">{t('l_share_target', lang)}</p>
      </Reveal>

      <Reveal as="section" className="card" index={3}>
        <h2>{t('live_meters', lang)}</h2>
        {m ? (
          <dl className="meters tnum">
            <div><dt>C / L calls</dt><dd>{m.callsByTier.C} / {m.callsByTier.L}</dd></div>
            <div><dt>p50 C/L</dt><dd>{m.p50.C}/{m.p50.L} ms</dd></div>
            <div><dt>p95 C/L</dt><dd>{m.p95.C}/{m.p95.L} ms</dd></div>
            <div><dt>{t('cache_hit', lang)}</dt><dd>{(m.cacheHitRate * 100).toFixed(1)}%</dd></div>
            <div><dt>{t('peer_first_rate', lang)}</dt><dd>{(m.peerFirstRate * 100).toFixed(1)}%</dd></div>
            <div><dt>{t('fallbacks', lang)}</dt><dd>{Object.entries(m.fallbackCounts).map(([k, v]) => `${k}:${v}`).join(' · ') || '—'}</dd></div>
            <div><dt>{t('kb_docs', lang)}</dt><dd>{m.kb.docs}</dd></div>
            <div><dt>{t('offline_snippets', lang)}</dt><dd>{m.offline.snippets}</dd></div>
          </dl>
        ) : (
          <div className="skel" style={{ height: 90 }} />
        )}
      </Reveal>

      <Reveal as="section" className="card chaos" index={4}>
        <h2>{t('chaos_console', lang)} · <span className={`mode-pill mode-${mode}`} translate="no">{mode.toUpperCase()}</span></h2>
        <div className="row">
          {MODES.map((md) => (
            <button
              key={md}
              type="button"
              className={`btn btn-small mode-btn mode-btn-${md}${mode === md ? '' : ' btn-ghost'}`}
              style={{ minHeight: 44 }}
              onClick={() => force(md)}
              translate="no"
              aria-pressed={mode === md}
            >
              {md.toUpperCase()}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-ghost btn-small" style={{ minHeight: 44 }} onClick={replay} disabled={replaying}>
          {replaying ? '…' : t('replay_walk', lang)}
        </button>
        <p className="muted budgets">{t('budgets', lang)}</p>
      </Reveal>

      <Reveal as="section" className="card" index={5}>
        <h2>{t('event_log', lang)} {sessionId && <span className="tnum" translate="no">{sessionId}</span>}</h2>
        <ol className="events">
          {events.map((e, i) => (
            <li key={`${e.ts}-${i}`}>
              <span className="event-type" translate="no">{e.type}</span>
              <span className="muted" translate="no">{e.actor}</span>
              <time className="tnum" dateTime={e.ts}>{new Date(e.ts).toLocaleTimeString()}</time>
              {e.payload && <code className="event-payload tnum" translate="no">{JSON.stringify(e.payload).slice(0, 80)}</code>}
            </li>
          ))}
          {events.length === 0 && <li className="muted">{t('no_events', lang)}</li>}
        </ol>
      </Reveal>
    </div>
  );
}
