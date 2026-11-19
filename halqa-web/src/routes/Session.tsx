import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type Health } from '../lib/api';
import { useSession } from '../lib/session';
import { stepLabel, t } from '../lib/i18n';
import { Reveal } from '../lib/motion';
import { QuotaMeter, SbuRings } from '../components/ui';
import { Composer, QuestionCard, StaleChip } from './session/QuestionFeed';
import { MembersBar } from './session/MembersRail';
import { CreditBar, RingsLegend } from './session/Shared';

/** R7 — the session room (spec §4). The CF-AS state machine rendered
 *  literally: countdown hero, peers-first, staged honest progress, ladder,
 *  polls, cites, credits, S-B-U. Pollers: questions 4s, state 1.5s (ETag),
 *  health+credits 5s — all paused on document.hidden, StaleChip after two
 *  consecutive failures.
 *
 *  This file composes the three columns only; the feed lives in
 *  ./session/QuestionFeed, the rails in ./session/MembersRail and
 *  ./session/Shared. */

export function SessionRoom() {
  const { circleId = '', sessionId = '' } = useParams();
  const { lang, learnerId, setCircleId, setSessionId, metrics } = useSession();
  const [health, setHealth] = useState<Health | null>(null);
  const [credits, setCredits] = useState<Array<{ learnerId: string; total: number }>>([]);
  const [questions, setQuestions] = useState<string[]>([]);
  const [agenda, setAgenda] = useState<Array<{ label: string; minutes?: number; done: boolean }> | null>(null);
  /** learnerId → nickname, so the credit bar names people instead of printing
   *  Mongo ids at them. Filled from the circle we are already in. */
  const [names, setNames] = useState<Record<string, string>>({});
  /** The room is three columns of sections and had no <h1> at all, so a screen
   *  reader arriving here got no page name. The topic is the honest one. */
  const [topic, setTopic] = useState('');
  /** Timestamp of the last successful list tick; `null` = healthy. */
  const [staleSince, setStaleSince] = useState<number | null>(null);

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
          setStaleSince(null);
          setQuestions((prev) => {
            const known = new Set(prev);
            return [...r.data.qids.filter((q) => !known.has(q)), ...prev];
          });
        })
        .catch(() => {
          fails += 1;
          // Age the chip from the last good tick, not from the moment it appeared.
          if (fails >= 2 && !dead) setStaleSince((s) => s ?? Date.now());
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
    // Names load once: the roster does not change mid-session.
    api
      .circleGet(circleId)
      .then((r) => {
        if (dead) return;
        const m: Record<string, string> = {};
        for (const mem of r.data.members) if (mem.nickname) m[mem.learnerId] = mem.nickname;
        setNames(m);
        setTopic(r.data.topic);
      })
      .catch(() => undefined);
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
              label: stepLabel(s.kind, lang),
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
  }, [circleId, sessionId, lang]);

  const usage = metrics?.quotaUsage.find((u) => u.sessionId === sessionId);

  return (
    <div className="page room">
      <h1 className="visually-hidden">{topic || t('questions_label', lang)}</h1>
      <div className="room-grid">
        <aside className="rail" aria-label={t('rail_agenda', lang)}>
          {agenda && (
            <Reveal as="section" className="card" index={0}>
              <h2>{t('agenda', lang)}</h2>
              <ol className="agenda">
                {agenda.map((s, i) => (
                  <li key={i}>
                    <span className="agenda-tick" aria-hidden="true">{s.done ? '✓' : '○'}</span>
                    <span>{s.label}</span>
                    {s.minutes != null && <span className="hint tnum">{s.minutes}′</span>}
                  </li>
                ))}
              </ol>
            </Reveal>
          )}
          <Reveal as="section" className="card" index={1}>
            <h2>{t('members', lang)}</h2>
            <MembersBar credits={credits} circleId={circleId} sessionId={sessionId} />
          </Reveal>
          <Link className="btn btn-ghost btn-small debrief-link" to={`/c/${circleId}/s/${sessionId}/debrief`}>
            {t('debrief', lang)}
          </Link>
        </aside>

        <section className="feed" aria-label={t('questions_label', lang)}>
          {staleSince !== null && <StaleChip since={staleSince} />}
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

        <aside className="rail" aria-label={t('rail_health', lang)}>
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
            <CreditBar credits={credits} names={names} />
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
