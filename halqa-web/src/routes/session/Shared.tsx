import { useSession } from '../../lib/session';
import { t } from '../../lib/i18n';

/** Small read-only pieces shared by the room rails. */

/** Credits are keyed by learner, but a Mongo id is not a person's name — pass the
 *  roster's nicknames and fall back to the id only when one is genuinely absent. */
export function CreditBar({ credits, names = {} }: { credits: Array<{ learnerId: string; total: number }>; names?: Record<string, string> }) {
  const { lang } = useSession();
  const max = Math.max(1, ...credits.map((c) => c.total));
  return (
    <ul className="credits" title={t('credits_formula', lang)}>
      {credits.map((c) => (
        <li key={c.learnerId}>
          <span translate="no">{names[c.learnerId] ?? c.learnerId}</span>
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

export function RingsLegend({ S, B, U }: { S: number; B: number; U: number }) {
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

