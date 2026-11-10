import { useEffect, useState } from 'react';
import { api, type DegradationMode, type Metrics } from '../lib/api';
import { useSession } from '../lib/session';

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

export function Lab() {
  const { sessionId, metrics } = useSession();
  const [m, setM] = useState<Metrics | null>(null);
  const [mode, setMode] = useState<DegradationMode>('green');
  const [events, setEvents] = useState<Array<{ ts: string; actor: string; type: string }>>([]);

  const load = () => {
    api
      .metrics(sessionId || undefined)
      .then((r) => setM(r.data))
      .catch(() => undefined);
    api
      .degradation()
      .then((r) => setMode(r.data.mode))
      .catch(() => undefined);
    if (sessionId)
      api
        .events(sessionId, 60)
        .then((r) => setEvents(r.data))
        .catch(() => undefined);
  };
  useEffect(() => {
    load();
    const id = setInterval(() => !document.hidden && load(), 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);
  void metrics;

  const force = async (md: DegradationMode) => {
    await api.chaos(md).catch(() => undefined);
    load();
  };

  return (
    <div className="page">
      <h1>Lab — engineering proof</h1>
      <section className="card" aria-label="Route table">
        <h2>Route table — step → tier → why</h2>
        <table className="rtable">
          <thead>
            <tr>
              <th>Step</th>
              <th>Tier</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            {STEPS.map((s) => (
              <tr key={s.step}>
                <td translate="no">{s.step}</td>
                <td translate="no">{s.tier}</td>
                <td>{s.why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card" aria-label="Live meters">
        <h2>Live meters {m && <span className="tnum">C={m.callsByTier.C} L={m.callsByTier.L} lShare={m.lShare.toFixed(3)} (target &lt;0.25)</span>}</h2>
        {m ? (
          <dl className="meters tnum">
            <div><dt>p50 C/L</dt><dd>{m.p50.C}/{m.p50.L} ms</dd></div>
            <div><dt>p95 C/L</dt><dd>{m.p95.C}/{m.p95.L} ms</dd></div>
            <div><dt>cache hit</dt><dd>{(m.cacheHitRate * 100).toFixed(1)}%</dd></div>
            <div><dt>peer-first</dt><dd>{(m.peerFirstRate * 100).toFixed(1)}%</dd></div>
            <div><dt>fallbacks</dt><dd>{JSON.stringify(m.fallbackCounts)}</dd></div>
            <div><dt>KB docs</dt><dd>{m.kb.docs}</dd></div>
            <div><dt>offline snippets</dt><dd>{m.offline.snippets}</dd></div>
          </dl>
        ) : (
          <div className="skel" style={{ height: 90 }} />
        )}
      </section>
      <section className="card" aria-label="Chaos console">
        <h2>Chaos console — mode: <span translate="no">{mode}</span></h2>
        <div className="row">
          {(['green', 'orange', 'red', 'black'] as const).map((md) => (
            <button key={md} type="button" className={`btn btn-small${mode === md ? '' : ' btn-ghost'}`} onClick={() => force(md)} translate="no" aria-pressed={mode === md}>
              {md}
            </button>
          ))}
        </div>
        <p className="muted">Budgets: skeleton &lt;1.5 s · compact &lt;4 s · larger &lt;12 s. Fallback shot rehearses here.</p>
      </section>
      <section className="card" aria-label="Event log">
        <h2>Event log {sessionId && <span className="tnum" translate="no">{sessionId}</span>}</h2>
        <ol className="events tnum">
          {events.map((e, i) => (
            <li key={i}>
              <span translate="no">{e.type}</span> · {e.actor} · {new Date(e.ts).toLocaleTimeString()}
            </li>
          ))}
          {events.length === 0 && <li className="muted">No events yet — ask the first question.</li>}
        </ol>
      </section>
    </div>
  );
}
