import { useEffect, useState } from 'react';
import { ApiFailure, REWRITE_STYLES, api, type RewriteStyle } from '../../lib/api';
import { useSession } from '../../lib/session';
import { styleLabel, t } from '../../lib/i18n';
import { ErrorNote } from '../../components/ui';
import { iconFor } from '../../lib/avatars';

/** R7 left rail — members + contribution dots, and the private Coach panel
 *  (explain-card + nudge + rephrase). Nudges are private by backend contract:
 *  we confirm to the sender, we never render them in the circle feed. */

export function MembersBar({ credits, circleId, sessionId }: { credits: Array<{ learnerId: string; total: number }>; circleId: string; sessionId: string }) {
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
              {/* The dot is decorative; the credit count was previously only in a
                  `title`, so a screen reader heard the name and nothing after it. */}
              <span className={`member-dot${total > 0 ? ' dot-on' : ''}`} aria-hidden="true" />
              <span className="visually-hidden">{t('credit_dot', lang, { n: total })}</span>
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
          targetName={roster.find((m) => m.learnerId === coach)?.nickname ?? coach}
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
export function CoachPanel({ target, targetName, circleId, sessionId, onClose }: { target: string; targetName: string; circleId: string; sessionId: string; onClose: () => void }) {
  const { lang } = useSession();
  const [card, setCard] = useState<{ card: string; visible: boolean } | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [rephrased, setRephrased] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [style, setStyle] = useState<RewriteStyle>('steps');
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
      const r = await api.coachRephrase({ sessionId, circleId, text: text.trim(), style, lang });
      setRephrased(r.suggestion);
    } catch (e) {
      setErr(((e as ApiFailure).body?.user_msg?.[lang]) ?? '—');
    }
  };

  return (
    <div className="coach-panel">
      <header className="coach-head">
        <strong translate="no">{targetName}</strong>
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
        <label className="field coach-style-field">
          <span>{t('coach_style', lang)}</span>
          <select value={style} onChange={(e) => setStyle(e.target.value as RewriteStyle)}>
            {REWRITE_STYLES.map((s) => (
              <option key={s} value={s}>{styleLabel(s, lang)}</option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn-ghost btn-small" style={{ minHeight: 44 }} disabled={!text.trim()} onClick={rephrase}>
          {t('rephrase', lang)}
        </button>
      </div>
      {rephrased && <p className="coach-out" translate="no">{rephrased}</p>}
      {err && <ErrorNote code="COACH" msg={err} retryable={false} />}
    </div>
  );
}

