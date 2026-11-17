import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiFailure, api, type Health, type Lang, type QuestionState } from '../lib/api';
import { useSession } from '../lib/session';
import { t } from '../lib/i18n';
import { Reveal, useSectionReveal } from '../lib/motion';
import { CiteChips, CountdownRing, ErrorNote, HatChip, SbuRings, QuotaMeter } from '../components/ui';
import { iconFor } from '../lib/avatars';

/** R7 — the session room (spec §4). The CF-AS state machine rendered
 *  literally: countdown hero, peers-first, staged honest progress, ladder,
 *  polls, cites, credits, S-B-U. Pollers: questions 4s, state 1.5s (ETag),
 *  health+credits 5s — all paused on document.hidden, StaleChip after two
 *  consecutive failures. */

export function SessionRoom() {
  const { circleId = '', sessionId = '' } = useParams();
  const { lang, learnerId, setCircleId, setSessionId, metrics } = useSession();
  const [health, setHealth] = useState<Health | null>(null);
  const [credits, setCredits] = useState<Array<{ learnerId: string; total: number }>>([]);
  const [questions, setQuestions] = useState<string[]>([]);
  const [agenda, setAgenda] = useState<Array<{ label: string; minutes?: number; done: boolean }> | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    setCircleId(circleId);
    setSessionId(sessionId);
  }, [circleId, sessionId, setCircleId, setSessionId]);

  // Joining mid-session: load already-asked questions, then keep polling (4s).
  useEffect(() => {
    let dead = false;
    let fails = 0;
    const load = () => {
      if (document.hidden) return;
      api
        .questionList(sessionId)
        .then((r) => {
          if (dead) return;
          fails = 0;
          setStale(false);
          setQuestions((prev) => {
            const known = new Set(prev);
            return [...r.data.qids.filter((q) => !known.has(q)), ...prev];
          });
        })
        .catch(() => {
          fails += 1;
          if (fails >= 2 && !dead) setStale(true);
        });
    };
    load();
    const id = setInterval(load, 4000);
    return () => {
      dead = true;
      clearInterval(id);
    };
  }, [sessionId]);

  // Health + credits + agenda — 5s poller.
  useEffect(() => {
    let dead = false;
    const tick = () => {
      if (document.hidden) return;
      api.circleHealth(circleId).then((r) => {
        if (!dead) {
          setHealth(r.data);
          setCredits(r.data.credits);
        }
      }).catch(() => undefined);
      api.sessionGet(sessionId).then((r) => {
        if (!dead)
          setAgenda(
            (r.data.agenda?.steps ?? []).map((s) => ({
              label: s.kind,
              minutes: s.plannedS != null ? Math.round(s.plannedS / 60) : undefined,
              done: s.done,
            })),
          );
      }).catch(() => undefined);
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
        <aside className="rail" aria-label="Agenda, members and credits">
          {agenda && (
            <Reveal as="section" className="card" index={0}>
              <h2>{t('agenda', lang)}</h2>
              <ol className="agenda">
                {agenda.map((s, i) => (
                  <li key={i}>
                    <span className="agenda-tick" aria-hidden="true">{s.done ? '✓' : '○'}</span>
                    <span translate="no">{s.label}</span>
                    {s.minutes != null && <span className="hint tnum">{s.minutes}′</span>}
                  </li>
                ))}
              </ol>
            </Reveal>
          )}
          <Reveal as="section" className="card" index={1}>
            <h2>{t('credits_formula', lang).split('·')[0] ? t('members', lang) : t('members', lang)}</h2>
            <MembersBar credits={credits} circleId={circleId} sessionId={sessionId} />
          </Reveal>
          <Link className="btn btn-ghost btn-small debrief-link" to={`/c/${circleId}/s/${sessionId}/debrief`}>
            {t('debrief', lang)}
          </Link>
        </aside>

        <section className="feed" aria-label="Questions">
          {stale && <StaleChip />}
          <Composer
            sessionId={sessionId}
            askerId={learnerId}
            lang={lang}
            onCreated={(qid) => setQuestions((q) => [qid, ...q])}
          />
          {questions.length === 0 && (
            <Reveal as="div" className="empty room-empty" index={1}>
              <h3>{t('no_questions', lang)}</h3>
              <p>{t('ask_hint', lang)}</p>
            </Reveal>
          )}
          {questions.map((qid) => (
            <QuestionCard key={qid} qid={qid} />
          ))}
        </section>

        <aside className="rail" aria-label="Health and budget">
          {health && (
            <Reveal as="section" className={`card${health.needsHuman ? ' needs-human' : ''}`} index={0}>
              <h2>{t('health', lang)}</h2>
              <SbuRings S={health.S} B={health.B} U={health.U} />
              <RingsLegend S={health.S} B={health.B} U={health.U} />
              {health.needsHuman && <p className="needs-human-text">{t('needs_human', lang)}</p>}
            </Reveal>
          )}
          <Reveal as="section" className="card" index={1}>
            <h2>{t('members', lang)}</h2>
            <CreditBar credits={credits} />
          </Reveal>
          {usage && (
            <Reveal as="section" className="card" index={2}>
              <h2>{t('budget', lang)}</h2>
              <QuotaMeter cUsed={usage.cUsed} cCap={usage.cCap} lUsed={usage.lUsed} lCap={usage.lCap} />
            </Reveal>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ---- left rail ------------------------------------------------------- */

function MembersBar({ credits, circleId, sessionId }: { credits: Array<{ learnerId: string; total: number }>; circleId: string; sessionId: string }) {
  const { learnerId, lang } = useSession();
  const [roster, setRoster] = useState<Array<{ learnerId: string; role: string; nickname?: string }>>([]);
  const [coach, setCoach] = useState<string | null>(null);

  useEffect(() => {
    api.circleGet(circleId).then((r) => setRoster(r.data.members)).catch(() => undefined);
  }, [circleId]);

  return (
    <>
      <ul className="members">
        {roster.map((m) => {
          const total = credits.find((c) => c.learnerId === m.learnerId)?.total ?? 0;
          return (
            <li key={m.learnerId}>
              <span className="member-glyph" aria-hidden="true" translate="no">{iconFor(undefined)}</span>
              <span className="member-name" translate="no">{m.nickname ?? m.learnerId}</span>
              <span className={`member-dot${total > 0 ? ' dot-on' : ''}`} title={`${total}`} />
              {m.learnerId === learnerId ? null : (
                <button
                  type="button"
                  className="member-coach"
                  onClick={() => setCoach(m.learnerId)}
                  aria-label={`${t('nudge', lang)} — ${m.nickname ?? m.learnerId}`}
                >
                  ☕
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {coach && (
        <CoachPanel
          target={coach}
          circleId={circleId}
          sessionId={sessionId}
          onClose={() => setCoach(null)}
        />
      )}
    </>
  );
}

/** Private Coach panel (spec R7 right/left): explain-card + nudge + rephrase.
 *  Nudge is private by backend contract — we confirm, we never display it publicly. */
function CoachPanel({ target, circleId, sessionId, onClose }: { target: string; circleId: string; sessionId: string; onClose: () => void }) {
  const { lang } = useSession();
  const [card, setCard] = useState<{ card: string; visible: boolean } | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [rephrased, setRephrased] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.explainCard(target).then((r) => setCard(r.data)).catch(() => undefined);
  }, [target]);

  const nudge = async () => {
    setErr(null);
    try {
      const r = await api.coachNudge(target, { sessionId, circleId });
      setSent(r.nudge);
    } catch (e) {
      setErr(((e as ApiFailure).body?.user_msg?.[lang]) ?? '—');
    }
  };

  const rephrase = async () => {
    if (!text.trim()) return;
    setErr(null);
    try {
      const r = await api.coachRephrase({ sessionId, circleId, text: text.trim(), lang });
      setRephrased(r.suggestion);
    } catch (e) {
      setErr(((e as ApiFailure).body?.user_msg?.[lang]) ?? '—');
    }
  };

  return (
    <div className="coach-panel">
      <header className="coach-head">
        <strong translate="no">{target}</strong>
        <button type="button" className="coach-x" onClick={onClose} aria-label={t('close', lang)}>✕</button>
      </header>
      {card?.visible && (
        <blockquote className="explain-card" translate="no">{card.card}</blockquote>
      )}
      {sent ? (
        <p className="hint" role="status">{t('nudge_sent', lang)}</p>
      ) : (
        <button type="button" className="btn btn-small" style={{ minHeight: 44 }} onClick={nudge}>
          {t('nudge', lang)}
        </button>
      )}
      <div className="coach-rephrase">
        <label className="visually-hidden" htmlFor="coach-re">{t('rephrase', lang)}</label>
        <textarea id="coach-re" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('rephrase', lang)} />
        <button type="button" className="btn btn-ghost btn-small" style={{ minHeight: 44 }} disabled={!text.trim()} onClick={rephrase}>
          {t('rephrase', lang)}
        </button>
      </div>
      {rephrased && <p className="coach-out" translate="no">{rephrased}</p>}
      {err && <ErrorNote code="COACH" msg={err} retryable={false} />}
    </div>
  );
}

/* ---- center feed ------------------------------------------------------ */

function Composer({ sessionId, askerId, lang, onCreated }: { sessionId: string; askerId: string; lang: Lang; onCreated: (qid: string) => void }) {
  const [text, setText] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const arabizi = /[0-9]|ch|gh|3lech|kifeh|bech|chnia/i.test(text) && /[a-z]/i.test(text);
  const long = text.trim().length > 240;
  const reveal = useSectionReveal(0);

  const ask = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    setPending(true); // optimistic skeleton card, spec §6.1
    setErr(null);
    try {
      const r = await api.questionCreate({ sessionId, askerId, text: v, anonymous });
      setText('');
      markMine(r.qid);
      onCreated(r.qid);
    } catch (e) {
      const f = e as ApiFailure;
      setErr(f.body?.user_msg?.[lang] ?? '—');
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={ask} className="card composer" {...reveal}>
      <label htmlFor="q">{t('ask_circle', lang)}</label>
      <textarea
        id="q"
        rows={2}
        required
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={600}
      />
      <div className="composer-meta">
        {arabizi && <span className="hint ok">Arabizi → Darija ✓</span>}
        {long && <span className="hint">{t('ask_hint', lang)}</span>}
      </div>
      <div className="row">
        <label className="check">
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
          <span aria-hidden="true">🙈</span> {t('anonymous', lang)}
        </label>
        <button type="submit" className="btn" style={{ minHeight: 44 }} disabled={text.trim().length === 0 || pending}>
          {t('ask', lang)}
        </button>
      </div>
      {pending && (
        <div className="card qcard" aria-busy="true">
          <div className="skel" style={{ height: 18 }} />
          <div className="skel" style={{ height: 56 }} />
        </div>
      )}
      {err && <ErrorNote code="ASK_FAILED" msg={err} retryable onRetry={() => setErr(null)} />}
    </form>
  );
}

function StaleChip() {
  const { lang } = useSession();
  return (
    <span className="stale-chip tnum" role="status">
      ⚠ {t('stale_s', lang).replace('{n}', '…')}
    </span>
  );
}

function QuestionCard({ qid }: { qid: string }) {
  const { learnerId } = useSession();
  const [view, setView] = useState<QuestionState | null>(null);
  const [fails, setFails] = useState(0);
  const etagRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    let dead = false;
    const tick = async () => {
      if (document.hidden || dead) return;
      try {
        const r = await api.questionState(qid, learnerId, etagRef.current);
        if (!dead) {
          setFails(0);
          if (!r.notModified && r.data) {
            setView(r.data as QuestionState);
            if (r.etag) etagRef.current = r.etag;
          }
        }
      } catch {
        if (!dead) setFails((f) => f + 1);
      }
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => {
      dead = true;
      clearInterval(id);
    };
  }, [qid, learnerId]);

  if (!view)
    return (
      <div className="card qcard" aria-busy="true">
        <div className="skel" style={{ height: 18 }} />
        <div className="skel" style={{ height: 44 }} />
        {fails >= 2 && <StaleChip />}
      </div>
    );

  const isAsker = view.stages !== undefined;
  return (
    <article className={`card qcard q-${view.state.toLowerCase()}`} aria-label={`Question — ${view.state}`}>
      <header className="qhead">
        <HatChip hat={view.state === 'RESOLVED' ? 'Tutor' : 'Facilitator'} />
        {view.state === 'OPEN' && view.windowEndsAt && <CountdownRing endsAt={view.windowEndsAt} />}
      </header>
      {view.text && <p className="qtext" translate="no">{view.text}</p>}
      {view.state === 'OPEN' && <OpenBody qid={qid} view={view} />}
      {view.state === 'NOVA_THINKING' && (isAsker ? <ThinkingSteps stages={view.stages ?? []} /> : <PeerThinking />)}
      {view.state === 'RESOLVED' && <ResolvedBody qid={qid} view={view} />}
    </article>
  );
}

function OpenBody({ qid, view }: { qid: string; view: QuestionState }) {
  const { lang, learnerId } = useSession();
  const [peerText, setPeerText] = useState('');
  const [meTooDone, setMeTooDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    await fn().catch(() => undefined).finally(() => setBusy(false));
  };
  return (
    <div className="stack">
      <p className="peers-first">{t('ask_hint', lang)}</p>
      <div className="row">
        <button type="button" className="btn btn-small" style={{ minHeight: 44 }} disabled={busy || meTooDone}
          onClick={() => act(() => api.meToo(qid, learnerId).then(() => setMeTooDone(true)))}>
          {meTooDone ? t('me_too_done', lang) : t('me_too', lang)}
        </button>
        {isMine(qid) && (
          <button type="button" className="btn btn-ghost btn-small" style={{ minHeight: 44 }} disabled={busy}
            onClick={() => act(() => api.skip(qid, learnerId))}>
            {t('skip', lang)}
          </button>
        )}
      </div>
      <form
        className="row peer-composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (!peerText.trim()) return;
          const v = peerText;
          setPeerText('');
          act(() => api.peerAnswer(qid, learnerId, v.trim()));
        }}
      >
        <label className="visually-hidden" htmlFor={`peer-${qid}`}>
          {t('i_can_help', lang)}
        </label>
        <input id={`peer-${qid}`} value={peerText} onChange={(e) => setPeerText(e.target.value)} placeholder={t('i_can_help', lang)} />
        <button type="submit" className="btn btn-small" style={{ minHeight: 44 }} disabled={peerText.trim().length === 0}>
          ✓
        </button>
      </form>
      <span className="muted tnum" aria-live="polite">
        {view.peerCount} {t('peer_answers', lang)}
      </span>
    </div>
  );
}

/** Asker-only detail is encoded in `stages`; the same key says who may skip.
 *  The state endpoint never returns askerId, so the client records which
 *  qids it created itself (sessionStorage) — the server stays the final
 *  source of truth (403 for anyone else). */
const myQids = () => new Set(JSON.parse(sessionStorage.getItem('halqa.myQids') ?? '[]') as string[]);
function markMine(qid: string) {
  const set = myQids();
  set.add(qid);
  sessionStorage.setItem('halqa.myQids', JSON.stringify([...set]));
}
function isMine(qid: string): boolean {
  return myQids().has(qid);
}

function ThinkingSteps({ stages }: { stages: Array<{ stage: string }> }) {
  const { lang } = useSession();
  return (
    <div className="thinking">
      <ol className="stages" aria-label="Nova progress">
        {stages.map((s, i) => {
          const done = stages[i + 1] !== undefined;
          return (
            <li key={`${s.stage}-${i}`} className={`stage${done ? ' stage-done' : ''}${!done && i === stages.length - 1 ? ' stage-live' : ''}`} translate="no">
              <span className="stage-dot" aria-hidden="true">{done ? '✓' : '●'}</span>
              {s.stage.replace(/_/g, ' ')}
            </li>
          );
        })}
      </ol>
      <p className="hint tnum">{t('thinking_note', lang)}</p>
    </div>
  );
}

/** Peers see exactly one line + a thin indeterminate bar (spec R7.3). */
function PeerThinking() {
  const { lang } = useSession();
  return (
    <div className="thinking peer">
      <p>{t('nova_thinking', lang)}</p>
      <span className="indeterminate" aria-hidden="true" />
    </div>
  );
}

function ResolvedBody({ qid, view }: { qid: string; view: QuestionState }) {
  const { lang, learnerId } = useSession();
  const [taken, setTaken] = useState(0);
  const [hints, setHints] = useState<Array<{ level: number; text: string }>>([]);
  const [hintErr, setHintErr] = useState<string | null>(null);
  const [full, setFull] = useState(false);

  const takeHint = async (level: number) => {
    setHintErr(null);
    try {
      const r = await api.hint(qid, learnerId, level);
      setHints((h) => [...h, { level: r.level ?? level, text: r.hint }]);
      setTaken((x) => Math.max(x, level));
    } catch (e) {
      const f = e as ApiFailure;
      const code = f.body?.code ?? '';
      setHintErr(
        code.includes('HINT_L4_LOCKED')
          ? t('l4_locked', lang)
          : code.includes('HINT_ASKER_ONLY')
            ? t('asker_only', lang)
            : (f.body?.user_msg?.[lang] ?? '—'),
      );
    }
  };

  const answer = view.answer;
  const isTruncated = !!answer?.truncated || (answer ? answer.text.length >= 600 : false);

  return (
    <div className="stack">
      {view.resolution === 'peers_verified' && (
        <>
          <p className="answer-text" translate="no">{answer?.text}</p>
          <p className="verified">
            ✓ {t('verified', lang)} {view.peerFirst && <span className="peerfirst">peer-first</span>}
          </p>
          <CiteChips cites={answer?.cites ?? []} />
        </>
      )}
      {view.resolution === 'hint_path' && (
        <>
          {answer?.text && <p className="answer-text" translate="no">{answer.text}</p>}
          <div className="ladder" role="group" aria-label={t('hint_ladder', lang)}>
            {[1, 2, 3, 4].map((l) => {
              const locked = l === 4 && taken < 3;
              return (
                <button
                  key={l}
                  type="button"
                  className={`step${taken >= l ? ' step-on' : ''}${locked ? ' step-locked' : ''}`}
                  onClick={() => takeHint(l)}
                  disabled={l !== 4 && taken >= l}
                  aria-label={
                    l === 4
                      ? locked
                        ? `◆ — ${t('hint_locked', lang)} 3`
                        : '◆'
                      : `H${l}`
                  }
                >
                  {locked ? '🔒' : l === 4 ? '◆' : `H${l}`}
                </button>
              );
            })}
          </div>
          {hints.map((h) => (
            <p key={h.level} className="hint-block">
              <strong className="tnum">H{h.level}</strong> <span translate="no">{h.text}</span>
            </p>
          ))}
          {hintErr && <ErrorNote code="HINT" msg={hintErr} retryable={false} />}
          <CiteChips cites={answer?.cites ?? []} />
        </>
      )}
      {view.resolution === 'skip_direct' && (
        <>
          <p className="answer-text" translate="no">
            {isTruncated && !full ? `${answer?.text.slice(0, 600)}…` : answer?.text}
          </p>
          {isTruncated && (
            <button type="button" className="linkish" style={{ minHeight: 44 }} onClick={() => setFull((f) => !f)}>
              {full ? t('read_less', lang) : t('read_full', lang)}
            </button>
          )}
          <p className="muted">
            <span className="tier-chip" translate="no">{answer?.tierUsed}</span>
            {answer?.cached && <span className="tier-chip">cached</span>}
            {answer?.tierUsed === 'T0' && <span className="tier-chip">offline</span>}
          </p>
          <CiteChips cites={answer?.cites ?? []} />
        </>
      )}
      {view.resolution === 'poll' && view.pollId && <PollBox pid={view.pollId} />}
      {view.deepDiveReady && view.deepDive && (
        <aside className="deepdive">
          <strong>✨</strong>
          <p translate="no">{view.deepDive.text}</p>
          <CiteChips cites={view.deepDive.cites} />
        </aside>
      )}
    </div>
  );
}

/** Poll card — choices as big rows with live tally bars; hardening rule:
 *  labels come from the fixed backend choice set, never JSON.stringify. */
function PollBox({ pid }: { pid: string }) {
  const { lang, learnerId } = useSession();
  const [tally, setTally] = useState<Record<string, number> | null>(null);
  const [voted, setVoted] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const choices = [
    { key: 'correct', label: t('poll_choice', lang) },
    { key: 'needs-fix', label: t('poll_fix', lang) },
  ];
  const max = Math.max(1, ...Object.values(tally ?? {}));

  const vote = async (choice: string) => {
    const r = await api.pollVote(pid, learnerId, choice).catch(() => null);
    if (r) {
      setTally(r.tally);
      setVoted(choice);
    }
  };
  const close = async () => {
    const r = await api.pollClose(pid).catch(() => null);
    if (r) {
      setTally(r.tally);
      setWinner(r.winner);
      setClosed(true);
    }
  };

  return (
    <div className="poll" role="group" aria-label="Poll" aria-live="polite">
      {choices.map((c) => (
        <button
          key={c.key}
          type="button"
          className={`poll-row${voted === c.key ? ' poll-voted' : ''}`}
          disabled={closed || voted !== null}
          style={{ minHeight: 44 }}
          onClick={() => vote(c.key)}
        >
          <span>{c.label}</span>
          <span className="poll-bar" aria-hidden="true">
            <i style={{ width: `${((tally?.[c.key] ?? 0) / max) * 100}%` }} />
          </span>
          <span className="tnum">{tally?.[c.key] ?? 0}</span>
        </button>
      ))}
      {!closed && (
        <button type="button" className="btn btn-ghost btn-small" style={{ minHeight: 44 }} onClick={close}>
          {t('close_poll', lang)}
        </button>
      )}
      {winner && (
        <p className="poll-winner">
          {t('winner', lang)}: <strong translate="no">{winner}</strong>
        </p>
      )}
    </div>
  );
}

/* ---- shared ----------------------------------------------------------- */

function CreditBar({ credits }: { credits: Array<{ learnerId: string; total: number }> }) {
  const { lang } = useSession();
  const max = Math.max(1, ...credits.map((c) => c.total));
  return (
    <ul className="credits" title={t('credits_formula', lang)}>
      {credits.map((c) => (
        <li key={c.learnerId}>
          <span className="tnum" translate="no">{c.learnerId}</span>
          <span className="bar" aria-hidden="true">
            <i style={{ width: `${(c.total / max) * 100}%` }} />
          </span>
          <span className="tnum">{c.total}</span>
        </li>
      ))}
      {credits.length === 0 && <li className="muted">—</li>}
    </ul>
  );
}

function RingsLegend({ S, B, U }: { S: number; B: number; U: number }) {
  const { lang } = useSession();
  const word = (v: number) => (v >= 0.75 ? t('tier_bright', lang) : v >= 0.45 ? t('tier_steady', lang) : t('tier_pulse', lang));
  return (
    <dl className="ring-legend">
      <div><dt>S</dt><dd>{word(S)}</dd></div>
      <div><dt>B</dt><dd>{word(B)}</dd></div>
      <div><dt>U</dt><dd>{word(U)}</dd></div>
    </dl>
  );
}
