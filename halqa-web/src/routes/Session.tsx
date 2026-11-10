import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiFailure, api, type Health, type Lang, type QuestionState } from '../lib/api';
import { useSession } from '../lib/session';
import { useCountdown } from '../lib/useCountdown';
import { t } from '../lib/i18n';
import { CiteChips, CountdownRing, ErrorNote, HatChip, SbuRings, QuotaMeter } from '../components/ui';

export function SessionRoom() {
  const { circleId = '', sessionId = '' } = useParams();
  const { lang, learnerId, setCircleId, setSessionId, metrics } = useSession();
  const [health, setHealth] = useState<Health | null>(null);
  const [credits, setCredits] = useState<Array<{ learnerId: string; total: number }>>([]);
  const [questions, setQuestions] = useState<string[]>([]);

  useEffect(() => {
    setCircleId(circleId);
    setSessionId(sessionId);
  }, [circleId, sessionId, setCircleId, setSessionId]);

  useEffect(() => {
    let dead = false;
    const tick = () => {
      if (document.hidden) return;
      api.circleHealth(circleId).then((r) => !dead && setHealth(r.data)).catch(() => undefined);
      api.sessionCredits(sessionId).then((r) => !dead && setCredits(r.data.credits)).catch(() => undefined);
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => {
      dead = true;
      clearInterval(id);
    };
  }, [circleId, sessionId]);

  const usage = metrics?.quotaUsage.find((u) => u.sessionId === sessionId);

  return (
    <div className="page room">
      <div className="room-grid">
        <aside className="rail" aria-label="Members and credits">
          <section className="card">
            <h2>Credits</h2>
            <CreditBar credits={credits} />
          </section>
          <section className="card">
            <h2>Links</h2>
            <Link to={`/c/${circleId}/s/${sessionId}/debrief`}>Debrief →</Link>
          </section>
        </aside>
        <section className="feed" aria-label="Questions">
          <Composer
            sessionId={sessionId}
            askerId={learnerId}
            lang={lang}
            onCreated={(qid) => setQuestions((q) => [qid, ...q])}
          />
          {questions.length === 0 && (
            <div className="empty">
              <h3>No questions yet</h3>
              <p>{t('peers_first', lang)}</p>
            </div>
          )}
          {questions.map((qid) => (
            <QuestionCard key={qid} qid={qid} />
          ))}
        </section>
        <aside className="rail" aria-label="Health and budget">
          {health && (
            <section className="card">
              <h2>Circle health</h2>
              <SbuRings S={health.S} B={health.B} U={health.U} />
              {health.needsHuman && <p className="needs-human">Needs a human — invite quiet voices.</p>}
            </section>
          )}
          {usage && (
            <section className="card">
              <h2>Budget</h2>
              <QuotaMeter cUsed={usage.cUsed} cCap={usage.cCap} lUsed={usage.lUsed} lCap={usage.lCap} />
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Composer({ sessionId, askerId, lang, onCreated }: { sessionId: string; askerId: string; lang: Lang; onCreated: (qid: string) => void }) {
  const [text, setText] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const arabizi = /[0-9]|ch|gh|3lech|kifeh|bech|chnia/i.test(text) && /[a-z]/i.test(text);

  const ask = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const r = await api.questionCreate({ sessionId, askerId, text: text.trim(), anonymous });
      setText('');
      onCreated(r.qid);
    } catch (e) {
      const f = e as ApiFailure;
      setErr(f.body?.user_msg?.[lang] ?? 'Could not ask.');
    }
  };

  return (
    <form onSubmit={ask} className="card composer">
      <label htmlFor="q">Ask the circle</label>
      <textarea id="q" rows={2} required value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Why must the array be sorted first?…" />
      {arabizi && <span className="hint ok">Arabizi → Darija ✓</span>}
      <div className="row">
        <label className="check">
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
          Anonymous
        </label>
        <button type="submit" className="btn" disabled={text.trim().length === 0}>
          {t('ask', lang)}
        </button>
      </div>
      {err && <ErrorNote code="ASK_FAILED" msg={err} retryable onRetry={() => setErr(null)} />}
    </form>
  );
}

function QuestionCard({ qid }: { qid: string }) {
  const { lang, learnerId } = useSession();
  const [view, setView] = useState<QuestionState | null>(null);
  const [etag, setEtag] = useState<string | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);

  const poll = useCallback(async () => {
    try {
      const r = await api.questionState(qid, learnerId, etag);
      if (!r.notModified && r.data) {
        setView(r.data as QuestionState);
        if (r.etag) setEtag(r.etag);
      }
    } catch (e) {
      const f = e as ApiFailure;
      setErr(f.body?.user_msg?.[lang] ?? 'State failed.');
    }
  }, [qid, learnerId, etag, lang]);

  useEffect(() => {
    let dead = false;
    let tag: string | undefined = undefined;
    const tick = async () => {
      if (document.hidden || dead) return;
      try {
        const r = await api.questionState(qid, learnerId, tag);
        if (!r.notModified && r.data && !dead) {
          setView(r.data as QuestionState);
          if (r.etag) tag = r.etag;
        }
      } catch {
        /* keep last state, never blank */
      }
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => {
      dead = true;
      clearInterval(id);
    };
  }, [qid, learnerId]);
  void poll;

  if (err && !view) return <ErrorNote code="QSTATE" msg={err} retryable onRetry={() => setErr(null)} />;
  if (!view)
    return (
      <div className="card" aria-busy="true">
        <div className="skel" style={{ height: 18 }} />
        <div className="skel" style={{ height: 44 }} />
      </div>
    );

  const isAsker = view.stages !== undefined;
  return (
    <article className="card qcard" aria-label={`Question ${view.state}`}>
      <header className="qhead">
        <HatChip hat={view.state === 'RESOLVED' ? 'Tutor' : 'Facilitator'} />
        <span className="qstate" translate="no">
          {view.state}
        </span>
        {view.state === 'OPEN' && view.windowEndsAt && <CountdownRing endsAt={view.windowEndsAt} />}
      </header>
      {view.state === 'OPEN' && <OpenBody qid={qid} view={view} />}
      {view.state === 'NOVA_THINKING' && (isAsker ? <ThinkingSteps stages={view.stages ?? []} /> : <p>{t('nova_thinking', lang)}</p>)}
      {view.state === 'RESOLVED' && <ResolvedBody qid={qid} view={view} />}
    </article>
  );
}

function OpenBody({ qid, view }: { qid: string; view: QuestionState }) {
  const { lang, learnerId } = useSession();
  const [peerText, setPeerText] = useState('');
  const remain = useCountdown(view.windowEndsAt);
  const act = async (fn: () => Promise<unknown>) => {
    await fn().catch(() => undefined);
  };
  return (
    <div className="stack">
      <p className="peers-first">{t('peers_first', lang)}</p>
      <div className="row">
        <button type="button" className="btn btn-ghost btn-small" onClick={() => act(() => api.meToo(qid, learnerId))}>
          {t('me_too', lang)}
        </button>
        <button
          type="button"
          className="btn btn-small"
          onClick={() =>
            act(async () => {
              await api.skip(qid, learnerId);
            })
          }
        >
          {t('skip', lang)}
        </button>
      </div>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!peerText.trim()) return;
          const v = peerText;
          setPeerText('');
          act(() => api.peerAnswer(qid, learnerId, v.trim()));
        }}
      >
        <label className="visually-hidden" htmlFor={`peer-${qid}`}>
          Help answer
        </label>
        <input id={`peer-${qid}`} value={peerText} onChange={(e) => setPeerText(e.target.value)} placeholder="I can help…" />
        <button type="submit" className="btn btn-small" disabled={peerText.trim().length === 0}>
          Send
        </button>
      </form>
      <span className="muted tnum">{view.peerCount} peer answers · {remain}s left</span>
    </div>
  );
}

function ThinkingSteps({ stages }: { stages: Array<{ stage: string }> }) {
  return (
    <ol className="stages" aria-label="Nova progress">
      {stages.map((s, i) => (
        <li key={`${s.stage}-${i}`} translate="no">
          {s.stage.replace(/_/g, ' ')}
        </li>
      ))}
    </ol>
  );
}

function ResolvedBody({ qid, view }: { qid: string; view: QuestionState }) {
  const { lang, learnerId } = useSession();
  const [hintLevel, setHintLevel] = useState(1);
  const [hintText, setHintText] = useState<string | null>(null);
  const [hintErr, setHintErr] = useState<string | null>(null);
  const [poll, setPoll] = useState<{ tally: Record<string, number> } | null>(null);

  const takeHint = async (level: number) => {
    setHintErr(null);
    try {
      const r = await api.hint(qid, learnerId, level);
      setHintText(r.hint);
      setHintLevel(level);
    } catch (e) {
      const f = e as ApiFailure;
      setHintErr(f.status === 403 ? t('l4_locked', lang) : (f.body?.user_msg?.[lang] ?? 'Hint failed.'));
    }
  };

  return (
    <div className="stack">
      {view.resolution === 'peers_verified' && (
        <>
          <p>{view.answer?.text}</p>
          <p className="verified">
            ✓ {t('verified', lang)} {view.peerFirst && <span className="peerfirst">peer-first</span>}
          </p>
          <CiteChips cites={view.answer?.cites ?? []} />
        </>
      )}
      {view.resolution === 'hint_path' && (
        <>
          <p>{view.answer?.text}</p>
          <div className="ladder" role="group" aria-label="Hint ladder">
            {[1, 2, 3, 4].map((l) => (
              <button key={l} type="button" className={`step${hintLevel >= l ? ' step-on' : ''}`} onClick={() => takeHint(l)} aria-label={`Hint ${l}${l === 4 ? ' (answer, locked until 1–3)' : ''}`}>
                {l === 4 ? '◆' : `H${l}`}
              </button>
            ))}
          </div>
          {hintText && <p>{hintText}</p>}
          {hintErr && <ErrorNote code="HINT" msg={hintErr} retryable={false} />}
          <CiteChips cites={view.answer?.cites ?? []} />
        </>
      )}
      {view.resolution === 'skip_direct' && (
        <>
          <p>{view.answer && view.answer.text.length > 600 ? `${view.answer.text.slice(0, 600)}…` : view.answer?.text}</p>
          <p className="muted">
            tier <span translate="no">{view.answer?.tierUsed}</span>
            {view.answer?.cached && ' · cached'}
            {view.answer?.tierUsed === 'T0' && ' · offline'}
          </p>
          <CiteChips cites={view.answer?.cites ?? []} />
        </>
      )}
      {view.resolution === 'poll' && view.pollId && (
        <PollBox
          pid={view.pollId}
          onTally={(tl) => setPoll({ tally: tl })}
        />
      )}
      {view.deepDiveReady && view.deepDive && (
        <p className="deepdive">
          ✨ deeper answer ready: {view.deepDive.text} <CiteChips cites={view.deepDive.cites} />
        </p>
      )}
      {poll && <span className="muted tnum">tally: {JSON.stringify(poll.tally)}</span>}
    </div>
  );
}

function PollBox({ pid, onTally }: { pid: string; onTally: (t: Record<string, number>) => void }) {
  const { learnerId } = useSession();
  const [tally, setTally] = useState<Record<string, number> | null>(null);
  const [winner, setWinner] = useState<string | null>(null);
  const vote = async (choice: string) => {
    const r = await api.pollVote(pid, learnerId, choice).catch(() => null);
    if (r) {
      setTally(r.tally);
      onTally(r.tally);
    }
  };
  const close = async () => {
    const r = await api.pollClose(pid).catch(() => null);
    if (r) setWinner(r.winner);
  };
  return (
    <div className="poll" role="group" aria-label="Group poll">
      <div className="row">
        <button type="button" className="btn btn-small" onClick={() => vote('correct')}>
          correct
        </button>
        <button type="button" className="btn btn-ghost btn-small" onClick={() => vote('needs-fix')}>
          needs-fix
        </button>
        <button type="button" className="btn btn-ghost btn-small" onClick={close}>
          Close
        </button>
      </div>
      {tally && <span className="tnum">correct {tally.correct ?? 0} · needs-fix {tally['needs-fix'] ?? 0}</span>}
      {winner && (
        <strong>
          Winner: <span translate="no">{winner}</span>
        </strong>
      )}
    </div>
  );
}

function CreditBar({ credits }: { credits: Array<{ learnerId: string; total: number }> }) {
  const max = Math.max(1, ...credits.map((c) => c.total));
  return (
    <ul className="credits">
      {credits.map((c) => (
        <li key={c.learnerId}>
          <span translate="no">{c.learnerId}</span>
          <span className="bar" aria-hidden="true">
            <i style={{ width: `${(c.total / max) * 100}%` }} />
          </span>
          <span className="tnum">{c.total}</span>
        </li>
      ))}
      {credits.length === 0 && <li className="muted">No credits yet — ask or help.</li>}
    </ul>
  );
}
