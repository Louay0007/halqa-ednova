import { useEffect, useRef, useState } from 'react';
import { ApiFailure, api, type Lang, type QuestionState } from '../../lib/api';

/** Asker-only payload from GET /questions/:qid/private. */
type PrivateView = {
  stages: Array<{ stage: string; startedAt?: string; doneAt?: string }>;
  quickTakeReady: boolean;
  deepDiveReady: boolean;
  deepDive?: { text: string; cites: string[] };
};
import { useSession } from '../../lib/session';
import { stageLabel, stateLabel, t, tierLabel } from '../../lib/i18n';
import { useSectionReveal } from '../../lib/motion';
import { plainParagraphs, plainText } from '../../lib/plain-text';
import { CiteChips, CountdownRing, ErrorNote, HatChip } from '../../components/ui';

/** R7 center feed — the CF-AS state machine: composer, countdown, peer window,
 *  staged thinking, and the four RESOLVED variants (peers_verified, hint_path,
 *  skip_direct, poll) plus the Deep-Dive slide-in. */

export function Composer({ sessionId, askerId, lang, onCreated }: { sessionId: string; askerId: string; lang: Lang; onCreated: (qid: string) => void }) {
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
        {arabizi && <span className="hint ok">{t('arabizi_note', lang)}</span>}
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

/** Spec §6.2 asks for a *measured* age ("stale 12s"), not a placeholder.
 *  `since` is the timestamp of the last successful tick; the chip re-renders
 *  itself once a second so the number actually climbs while the API is out. */
export function StaleChip({ since }: { since: number }) {
  const { lang } = useSession();
  const [age, setAge] = useState(() => Math.max(0, Math.round((Date.now() - since) / 1000)));
  useEffect(() => {
    const id = setInterval(() => setAge(Math.max(0, Math.round((Date.now() - since) / 1000))), 1000);
    return () => clearInterval(id);
  }, [since]);
  return (
    <span className="stale-chip tnum" role="status">
      ⚠ {t('stale_s', lang, { n: age })}
    </span>
  );
}

export function QuestionCard({ qid }: { qid: string }) {
  const { lang, learnerId } = useSession();
  const [view, setView] = useState<QuestionState | null>(null);
  const [priv, setPriv] = useState<PrivateView | null>(null);
  const [fails, setFails] = useState(0);
  const [okAt, setOkAt] = useState<number | null>(null);
  const [failedAt, setFailedAt] = useState(0);
  const etagRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    let dead = false;
    const tick = async () => {
      if (document.hidden || dead) return;
      try {
        const r = await api.questionState(qid, etagRef.current);
        if (!dead) {
          setFails(0);
          setOkAt(Date.now());
          if (!r.notModified && r.data) {
            setView(r.data as QuestionState);
            if (r.etag) etagRef.current = r.etag;
          }
        }
      } catch {
        if (!dead) {
          // freeze the first failure time so the chip has a real anchor
          setFailedAt((t0) => t0 || Date.now());
          setFails((f) => f + 1);
        }
      }
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => {
      dead = true;
      clearInterval(id);
    };
  }, [qid, learnerId]);

  /**
   * Asker-only extras live on their own route now, so the shared poller carries
   * nothing viewer-dependent. Poll them only for questions this device asked —
   * the server still enforces asker-only with a 403, this just avoids the noise.
   */
  const mine = isMine(qid);
  useEffect(() => {
    if (!mine) return;
    let dead = false;
    const tick = async () => {
      if (document.hidden || dead) return;
      try {
        const r = await api.questionPrivate(qid);
        if (!dead) setPriv(r.data);
      } catch {
        // Not an asker (e.g. created on another device): drop the private view
        // and let the card render its peer variant.
        if (!dead) setPriv(null);
      }
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => {
      dead = true;
      clearInterval(id);
    };
  }, [qid, mine]);

  if (!view)
    return (
      <div className="card qcard" aria-busy="true">
        <div className="skel" style={{ height: 18 }} />
        <div className="skel" style={{ height: 44 }} />
        {fails >= 2 && <StaleChip since={okAt ?? failedAt} />}
      </div>
    );

  const isAsker = mine && priv !== null;
  // State modifier is hyphenated (q-nova-thinking), not the enum's underscore:
  // `q-nova_thinking` is a class no stylesheet will ever be written against.
  return (
    <article
      className={`card qcard q-${view.state.toLowerCase().replace(/_/g, '-')}`}
      aria-label={t('question_label', lang, { state: stateLabel(view.state, lang) })}
    >
      <header className="qhead">
        <HatChip hat={view.state === 'RESOLVED' ? 'Tutor' : 'Facilitator'} />
        {view.state === 'OPEN' && view.windowEndsAt && <CountdownRing endsAt={view.windowEndsAt} />}
      </header>
      {view.text && <p className="qtext" dir="auto" translate="no">{view.text}</p>}
      {view.state === 'OPEN' && <OpenBody qid={qid} view={view} />}
      {view.state === 'NOVA_THINKING' && (isAsker ? <ThinkingSteps stages={priv?.stages ?? []} /> : <PeerThinking />)}
      {view.state === 'RESOLVED' && <ResolvedBody qid={qid} view={view} priv={priv} />}
    </article>
  );
}

export function OpenBody({ qid, view }: { qid: string; view: QuestionState }) {
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
          {t('send_answer', lang)}
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

export function ThinkingSteps({ stages }: { stages: Array<{ stage: string }> }) {
  const { lang } = useSession();
  return (
    <div className="thinking">
      <ol className="stages" aria-label={t('nova_progress', lang)}>
        {stages.map((s, i) => {
          const done = stages[i + 1] !== undefined;
          return (
            // translate="no" is gone: the stage is now our own translated prose,
            // and marking it non-translatable told browsers to leave it in English.
            <li key={`${s.stage}-${i}`} className={`stage${done ? ' stage-done' : ''}${!done && i === stages.length - 1 ? ' stage-live' : ''}`}>
              <span className="stage-dot" aria-hidden="true">{done ? '✓' : '●'}</span>
              {stageLabel(s.stage, lang)}
            </li>
          );
        })}
      </ol>
      <p className="hint tnum">{t('thinking_note', lang)}</p>
    </div>
  );
}

/** Peers see exactly one line + a thin indeterminate bar (spec R7.3). */
export function PeerThinking() {
  const { lang } = useSession();
  return (
    <div className="thinking peer">
      <p>{t('nova_thinking', lang)}</p>
      <span className="indeterminate" aria-hidden="true" />
    </div>
  );
}

export function ResolvedBody({ qid, view, priv }: { qid: string; view: QuestionState; priv?: PrivateView | null }) {
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
          <p className="answer-text" dir="auto" translate="no">{plainText(answer?.text)}</p>
          <p className="verified">
            ✓ {t('verified', lang)} {view.peerFirst && <span className="tier-chip">{t('peer_first_rate', lang)}</span>}
          </p>
          <CiteChips cites={answer?.cites ?? []} />
        </>
      )}
      {view.resolution === 'hint_path' && (
        <>
          {answer?.text && <p className="answer-text" dir="auto" translate="no">{plainText(answer.text)}</p>}
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
              <strong className="tnum">H{h.level}</strong> <span dir="auto" translate="no">{plainText(h.text)}</span>
            </p>
          ))}
          {hintErr && <ErrorNote code="HINT" msg={hintErr} retryable={false} />}
          <CiteChips cites={answer?.cites ?? []} />
        </>
      )}
      {view.resolution === 'skip_direct' && (
        <>
          <p className="answer-text" dir="auto" translate="no">
            {isTruncated && !full ? `${plainText(answer?.text).slice(0, 600)}…` : plainText(answer?.text)}
          </p>
          {isTruncated && (
            <button type="button" className="linkish" style={{ minHeight: 44 }} onClick={() => setFull((f) => !f)}>
              {full ? t('read_less', lang) : t('read_full', lang)}
            </button>
          )}
          <p className="muted">
            {/* `C` / `T0` are billing tiers, not learner-facing words. */}
            <span className="tier-chip">{tierLabel(answer?.tierUsed ?? '', lang)}</span>
            {answer?.cached && <span className="tier-chip">{t('cached', lang)}</span>}
            {answer?.tierUsed === 'T0' && <span className="tier-chip">{t('offline_tag', lang)}</span>}
          </p>
          <CiteChips cites={answer?.cites ?? []} />
        </>
      )}
      {view.resolution === 'poll' && view.pollId && <PollBox pid={view.pollId} />}
      {priv?.deepDiveReady && priv.deepDive && (
        <aside className="deepdive">
          <strong>✨</strong>
          {plainParagraphs(priv.deepDive.text).map((p, i) => (
            <p key={i} dir="auto" translate="no">{p}</p>
          ))}
          <CiteChips cites={priv.deepDive.cites} />
        </aside>
      )}
    </div>
  );
}

/** Poll card — choices as big rows with live tally bars; hardening rule:
 *  labels come from the fixed backend choice set, never JSON.stringify. */
export function PollBox({ pid }: { pid: string }) {
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
    <div className="poll" role="group" aria-label={t('poll_label', lang)} aria-live="polite">
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
          {t('winner', lang)}: <strong dir="auto" translate="no">{winner}</strong>
        </p>
      )}
    </div>
  );
}

