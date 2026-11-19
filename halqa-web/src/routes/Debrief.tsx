import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiFailure, api, type Capsule } from '../lib/api';
import { useSession } from '../lib/session';
import { ErrorNote, HatChip, SbuRings } from '../components/ui';
import { Reveal } from '../lib/motion';
import { t } from '../lib/i18n';

interface EndSummary {
  endedAt?: string;
  health?: { S: number; B: number; U: number; needsHuman?: boolean };
  credits?: Array<{ learnerId: string; total: number }>;
}

export function Debrief() {
  const { circleId = '', sessionId = '' } = useParams();
  const { lang, learnerId } = useSession();
  const [capsule, setCapsule] = useState<Capsule | null>(null);
  const [building, setBuilding] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [battle, setBattle] = useState<{
    bid: string;
    items: Array<{ qid: string; stem: string; choices: Array<{ key: string; text: string }> }>;
  } | null>(null);
  const [answers, setAnswers] = useState<Record<string, { correct: boolean; explain: string; xp: number }>>({});
  const [xp, setXp] = useState<{ total: number; badges: string[]; streakDays: number } | null>(null);
  const [toast, setToast] = useState<number | null>(null);
  const [whisper, setWhisper] = useState<{ chainId: string; steps: unknown[]; driftMap: Drift; tier: string } | null>(null);
  const [relay, setRelay] = useState('');
  const [repairText, setRepairText] = useState('');
  const [coverage, setCoverage] = useState<number | null>(null);
  const [topic, setTopic] = useState('binary_search');
  const [summary, setSummary] = useState<EndSummary | null>(null);

  useEffect(() => {
    api.circleGet(circleId).then((r) => r.data?.topic && setTopic(r.data.topic)).catch(() => undefined);
    api
      .sessionEnd(sessionId) // idempotent server-side
      .then((r) => setSummary(r as unknown as EndSummary))
      .catch(() => undefined)
      .finally(() =>
        api
          .capsuleBuild(sessionId)
          .then((r) => setCapsule(r as unknown as Capsule))
          .catch((e: ApiFailure) => setErr(e.body?.user_msg?.[lang] ?? '—'))
          .finally(() => setBuilding(false)),
      );
    if (learnerId) api.progress().then((r) => setXp(r.data)).catch(() => undefined);
  }, [sessionId, circleId, lang, learnerId]);

  const startBattle = async () => {
    setErr(null);
    try {
      const r = await api.quizBattle(circleId, sessionId);
      setBattle(r as unknown as typeof battle);
    } catch (e) {
      setErr(((e as ApiFailure).body?.user_msg?.[lang]) ?? '—');
    }
  };

  const answerBattle = async (qid: string, choice: string) => {
    if (!battle || answers[qid]) return;
    try {
      const r = await api.quizAnswer(battle.bid, { sessionId, circleId, learnerId, qid, choice });
      setAnswers((a) => ({ ...a, [qid]: r }));
      setToast(r.xp);
      setTimeout(() => setToast(null), 2400);
      const x = await api.progress().catch(() => null);
      if (x) setXp(x.data);
    } catch (e) {
      setErr(((e as ApiFailure).body?.user_msg?.[lang]) ?? '—');
    }
  };

  const runWhisper = async () => {
    setErr(null);
    const qids = await api.questionList(sessionId).then((r) => r.data?.qids ?? []).catch(() => []);
    // `POST /whisper` runs `assertMembers` over every step author, so a synthetic
    // 'peer' id is a guaranteed 403. The relay is the learner's own retelling of
    // what peers said — attributing it to them is also what the exercise means.
    const answered = await Promise.all(
      qids.slice(0, 3).map((qid) =>
        api.questionState(qid).then((r) => (r.data?.resolution === 'peers_verified' && r.data.answer ? [{ authorId: learnerId, text: r.data.answer.text }] : [])).catch(() => []),
      ),
    );
    const steps = [...answered.flat()];
    if (relay.trim()) steps.push({ authorId: learnerId, text: relay.trim() });
    if (steps.length < 2) {
      setErr(t('whisper_need_two', lang));
      return;
    }
    const r = await api.whisper({ sessionId, circleId, topic, steps }).catch(() => null);
    if (r) setWhisper(r as unknown as typeof whisper);
    else setErr(t('whisper_failed', lang));
  };

  const repair = async () => {
    if (!whisper || !repairText.trim()) return;
    const r = await api.whisperRepair(whisper.chainId, { sessionId, circleId, text: repairText }).catch(() => null);
    if (r) setCoverage(r.coverage);
  };

  return (
    <div className="page debrief">
      {toast !== null && (
        <div className="xp-toast tnum" role="status" aria-live="polite">
          ✨ +{toast} XP
        </div>
      )}
      <Reveal as="header" className="duo-head" index={0}>
        <h1>{t('debrief_title', lang)}</h1>
        <p className="muted">{t('debrief_sub', lang)}</p>
      </Reveal>
      {err && <ErrorNote code="DEBRIEF" msg={err} retryable onRetry={() => setErr(null)} />}

      <Reveal as="section" className="card capsule-card" index={1} aria-busy={building}>
        <header className="row">
          <HatChip hat="Facilitator" />
          <span className="muted tnum">{capsule ? `${capsule.tier} · +${capsule.xp_earned} XP` : '…'}</span>
        </header>
        <h2>{t('capsule', lang)}</h2>
        {building ? (
          <>
            <div className="skel" style={{ height: 18 }} />
            <div className="skel" style={{ height: 60 }} />
            <p className="hint">{t('capsule_building', lang)}</p>
          </>
        ) : capsule ? (
          <>
            <ol className="capsule-bullets">
              {capsule.bullets.map((b, i) => <li key={i} translate="no">{b}</li>)}
            </ol>
            <div className="capsule-visual">
              <span aria-hidden="true">▧</span>
              <p translate="no">{capsule.visual_desc}</p>
            </div>
            <p className="capsule-next"><strong>{t('next_step', lang)}:</strong> <span translate="no">{capsule.next_step}</span></p>
            {capsule.mini_quiz?.length > 0 && (
              <>
                <h3 className="capsule-quiz-title">{t('mini_quiz', lang)}</h3>
                <ol className="capsule-quiz">
                  {capsule.mini_quiz.map((q, i) => (
                    <li key={i} translate="no">{q}</li>
                  ))}
                </ol>
              </>
            )}
          </>
        ) : null}
      </Reveal>

      <Reveal as="section" className="card" index={2}>
        <header className="row"><HatChip hat="Facilitator" /><h2>{t('battle', lang)}</h2></header>
        {!battle ? (
          <button type="button" className="btn" style={{ minHeight: 44 }} onClick={startBattle}>{t('battle_start', lang)}</button>
        ) : (
          battle.items.map((it) => {
            const ans = answers[it.qid];
            return (
              <div key={it.qid} className="quiz-item">
                <p translate="no">{it.stem}</p>
                <div className="row">
                  {it.choices.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      className={`btn btn-small${ans ? ' btn-ghost' : ''}`}
                      style={{ minHeight: 44 }}
                      disabled={!!ans}
                      // Submit the key: the server scores the letter, and display
                      // text is never what it stored as the answer.
                      onClick={() => answerBattle(it.qid, c.key)}
                      translate="no"
                    >
                      {c.text}
                    </button>
                  ))}
                </div>
                {ans && (
                  <p className={`quiz-result${ans.correct ? ' quiz-correct' : ''}`}>
                    {ans.correct ? t('battle_win', lang) : t('battle_retry', lang)} · <span translate="no">{ans.explain}</span>
                  </p>
                )}
              </div>
            );
          })
        )}
      </Reveal>

      <Reveal as="section" className="card" index={3}>
        <header className="row"><HatChip hat="Mediator" /><h2>{t('whisper', lang)}</h2></header>
        {!whisper ? (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); void runWhisper(); }}>
            <label htmlFor="relay">{t('whisper_turn', lang)}</label>
            <textarea id="relay" rows={2} value={relay} onChange={(e) => setRelay(e.target.value)} placeholder={t('whisper_placeholder', lang)} />
            <button type="submit" className="btn btn-ghost" style={{ minHeight: 44 }}>{t('whisper_start', lang)}</button>
          </form>
        ) : (
          <>
            <DriftMapView drift={whisper.driftMap} />
            <form className="row whisper-repair" onSubmit={(e) => { e.preventDefault(); void repair(); }}>
              <label className="visually-hidden" htmlFor="repair">{t('whisper_repair', lang)}</label>
              <input id="repair" value={repairText} onChange={(e) => setRepairText(e.target.value)} placeholder={t('whisper_repair', lang)} />
              <button type="submit" className="btn btn-small" style={{ minHeight: 44 }} disabled={!repairText.trim()}>{t('whisper_repair', lang)}</button>
            </form>
            {coverage !== null && (
              <p className="coverage tnum" role="status">{(coverage * 100).toFixed(0)}% {t('coverage', lang)}</p>
            )}
          </>
        )}
      </Reveal>

      {xp && (
        <Reveal as="section" className="card xp-panel" index={4} aria-live="polite">
          <h2>XP <span className="tnum">{xp.total}</span></h2>
          <div className="badges">
            {xp.badges.map((b) => <span key={b} className="badge" translate="no">{b}</span>)}
            {xp.badges.length === 0 && <span className="muted">{t('badges_hint', lang)}</span>}
          </div>
        </Reveal>
      )}

      {summary && (
        <Reveal as="section" className="card end-summary" index={5}>
          <h2>{t('end_session', lang)}</h2>
          {summary.health && <SbuRings S={summary.health.S} B={summary.health.B} U={summary.health.U} />}
          <p className="hint">
            {t('end_summary', lang, { n: summary.credits?.length ?? 0 })}
          </p>
        </Reveal>
      )}

      <p><Link to={`/c/${circleId}`}>← {t('nav_circle', lang)}</Link></p>
    </div>
  );
}

interface Drift { kept: string[]; lost: string[]; distorted: string[]; added: string[] }

export function DriftMapView({ drift }: { drift: Drift }) {
  const { lang } = useSession();
  const groups: Array<[string, string[], string]> = [
    [t('drift_kept', lang), drift.kept, 'drift-kept'],
    [t('drift_lost', lang), drift.lost, 'drift-lost'],
    [t('drift_distorted', lang), drift.distorted, 'drift-dist'],
    [t('drift_added', lang), drift.added, 'drift-add'],
  ];
  return (
    <div className="drift" role="group" aria-label={t('drift_map', lang)}>
      {groups.map(([label, ids, cls]) => (
        <div key={cls} className={`drift-col ${cls}`}>
          <strong>{label}</strong>
          {ids.length ? ids.map((id) => <span key={id} className="chip" translate="no">{id}</span>) : <span className="muted">—</span>}
        </div>
      ))}
    </div>
  );
}
