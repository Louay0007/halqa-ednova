import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiFailure, api, type Capsule } from '../lib/api';
import { useSession } from '../lib/session';
import { CiteChips, ErrorNote, HatChip } from '../components/ui';

export function Debrief() {
  const { circleId = '', sessionId = '' } = useParams();
  const { lang, learnerId } = useSession();
  const [capsule, setCapsule] = useState<Capsule | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [battle, setBattle] = useState<{ bid: string; items: Array<{ qid: string; stem: string; choices: string[] }> } | null>(null);
  const [xp, setXp] = useState<{ total: number; badges: string[] } | null>(null);
  const [whisper, setWhisper] = useState<{ chainId: string; driftMap: { kept: string[]; lost: string[]; distorted: string[]; added: string[] } } | null>(null);
  const [repairText, setRepairText] = useState('');
  const [coverage, setCoverage] = useState<number | null>(null);
  const [topic, setTopic] = useState('binary_search');
  const [lastMine, setLastMine] = useState('');
  const [relay, setRelay] = useState('');

  useEffect(() => {
    api
      .circleGet(circleId)
      .then((r) => r.data?.topic && setTopic(r.data.topic))
      .catch(() => undefined);
    // The capsule and the health rings are only meaningful on a closed session.
    // `end` is idempotent server-side (it just re-stamps endedAt), so it is safe to call on mount.
    api
      .sessionEnd(sessionId)
      .catch(() => undefined)
      .then(() => api.capsuleBuild(sessionId))
      .then((r) => setCapsule(r as unknown as Capsule))
      .catch((e: ApiFailure) => setErr(e.body?.user_msg?.[lang] ?? 'Capsule failed.'));
    api
      .xp(learnerId)
      .then((r) => setXp(r.data))
      .catch(() => undefined);
  }, [sessionId, circleId, lang, learnerId]);

  const startBattle = async () => {
    const r = await api.quizBattle(circleId, sessionId).catch(() => null);
    if (r) setBattle(r);
  };
  const answerBattle = async (qid: string, choice: string) => {
    if (!battle) return;
    await api.quizAnswer(battle.bid, { sessionId, circleId, learnerId, qid, choice }).catch(() => undefined);
    const x = await api.xp(learnerId).catch(() => null);
    if (x) setXp(x.data);
  };
  const runWhisper = async () => {
    // The relay needs a real chain (>=2 links). Pull the session's peer answers; if the circle
    // was too quiet, fall back to the two links the learner can always supply.
    const qids = await api
      .questionList(sessionId)
      .then((r) => r.data?.qids ?? [])
      .catch(() => []);
    const answered = await Promise.all(
      qids.slice(0, 3).map((qid) =>
        api
          .questionState(qid)
          .then((r) => (r.data?.resolution === 'peers_verified' && r.data.answer ? [{ authorId: 'peer', text: r.data.answer.text }] : []))
          .catch(() => []),
      ),
    );
    const steps = [...answered.flat(), ...(lastMine.trim() ? [{ authorId: learnerId, text: lastMine.trim() }] : [])];
    const chain = steps.length >= 2 ? steps : [{ authorId: learnerId, text: relay.trim() || 'Binary search halves a sorted array.' }];
    if (chain.length < 2) {
      setErr('Relay needs two links — add what you remember.');
      return;
    }
    const r = await api
      .whisper({ sessionId, circleId, topic, steps: chain })
      .catch(() => null);
    if (r) setWhisper(r as { chainId: string; driftMap: { kept: string[]; lost: string[]; distorted: string[]; added: string[] } });
    else setErr('Relay failed — retry.');
  };

  return (
    <div className="page">
      <h1>Debrief — what stuck</h1>
      {err && <ErrorNote code="CAPSULE" msg={err} retryable onRetry={() => location.reload()} />}
      {capsule ? (
        <article className="card" aria-label="Revision capsule">
          <header className="row">
            <HatChip hat="Facilitator" />
            <span className="muted">
              tier <span translate="no">{capsule.tier}</span> · +{capsule.xp_earned} XP
            </span>
          </header>
          <ul>
            {capsule.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
          <p className="muted">{capsule.visual_desc}</p>
          <p>
            <strong>Next:</strong> {capsule.next_step}
          </p>
          <CiteChips cites={capsule.mini_quiz} />
        </article>
      ) : (
        !err && (
          <div className="card" aria-busy="true">
            <div className="skel" style={{ height: 18 }} />
            <div className="skel" style={{ height: 60 }} />
          </div>
        )
      )}
      <section className="card">
        <h2>Boss battle</h2>
        {!battle ? (
          <button type="button" className="btn" onClick={startBattle}>
            Start battle
          </button>
        ) : (
          battle.items.map((it) => (
            <div key={it.qid} className="quiz-item">
              <p>{it.stem}</p>
              <div className="row">
                {it.choices.map((c) => (
                  <button key={c} type="button" className="btn btn-ghost btn-small" onClick={() => answerBattle(it.qid, c)} translate="no">
                    {c}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
      <section className="card">
        <h2>Whisper chain</h2>
        {!whisper ? (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              const mine = relay.trim();
              if (mine) setLastMine((prev) => prev || mine);
              void runWhisper();
            }}
          >
            <label htmlFor="relay">Your turn — what do you still remember?</label>
            <textarea id="relay" rows={2} value={relay} onChange={(e) => setRelay(e.target.value)} placeholder="Explain it to the next person…" />
            <button type="submit" className="btn btn-ghost">
              Run relay
            </button>
          </form>
        ) : (
          <>
            <DriftMapView drift={whisper.driftMap} />
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                api.whisperRepair(whisper.chainId, { sessionId, circleId, text: repairText }).then((r) => setCoverage(r.coverage)).catch(() => undefined);
              }}
            >
              <label className="visually-hidden" htmlFor="repair">
                Repair the chain
              </label>
              <input id="repair" value={repairText} onChange={(e) => setRepairText(e.target.value)} placeholder="Repair together…" />
              <button type="submit" className="btn btn-small">
                Repair
              </button>
            </form>
            {coverage !== null && <span className="tnum">coverage {(coverage * 100).toFixed(0)}%</span>}
          </>
        )}
      </section>
      {xp && (
        <section className="card" aria-label="Your progress">
          <h2>
            XP <span className="tnum">{xp.total}</span>
          </h2>
          <div className="badges">
            {xp.badges.map((b) => (
              <span key={b} className="badge">
                {b}
              </span>
            ))}
            {xp.badges.length === 0 && <span className="muted">Badges unlock as you help.</span>}
          </div>
        </section>
      )}
      <p>
        <Link to={`/c/${circleId}`}>← Back to lobby</Link>
      </p>
    </div>
  );
}

export function DriftMapView({ drift }: { drift: { kept: string[]; lost: string[]; distorted: string[]; added: string[] } }) {
  const groups: Array<[string, string[], string]> = [
    ['kept', drift.kept, 'drift-kept'],
    ['lost', drift.lost, 'drift-lost'],
    ['distorted', drift.distorted, 'drift-dist'],
    ['added', drift.added, 'drift-add'],
  ];
  return (
    <div className="drift" role="group" aria-label="Drift map">
      {groups.map(([k, ids, cls]) => (
        <div key={k} className={`drift-col ${cls}`}>
          <strong>{k}</strong>
          {ids.map((id) => (
            <span key={id} className="chip" translate="no">
              {id}
            </span>
          ))}
          {ids.length === 0 && <span className="muted">—</span>}
        </div>
      ))}
    </div>
  );
}
