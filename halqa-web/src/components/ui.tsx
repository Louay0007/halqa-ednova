import './ui.css';
import { useSession } from '../lib/session';
import { hatLabel, t } from '../lib/i18n';

const HAT_CLASS: Record<string, string> = {
  Mediator: 'hat-mediator',
  Teammate: 'hat-teammate',
  Tutor: 'hat-tutor',
  Facilitator: 'hat-facilitator',
  NOVA_NOVICE: 'hat-teammate',
  NOVA_CURIOUS: 'hat-teammate',
  NOVA_SKEPTIC: 'hat-mediator',
  NOVA_EXAMINER: 'hat-facilitator',
  NOVA: 'hat-tutor',
};

/** Hat badge. The label is translated — it used to read "Mediator · وسيط" in
 *  every language, which is only correct in `ar`/`darija`. */
export function HatChip({ hat }: { hat: string }) {
  const { lang } = useSession();
  return (
    <span className={`hat ${HAT_CLASS[hat] ?? 'hat-tutor'}`} translate="no">
      ★ {hatLabel(hat, lang)}
    </span>
  );
}

export function SbuRings({ S, B, U }: { S: number; B: number; U: number }) {
  const { lang } = useSession();
  const rings = [
    { k: 'S', v: S, name: t('sbu_structured', lang) },
    { k: 'B', v: B, name: t('sbu_balanced', lang) },
    { k: 'U', v: U, name: t('sbu_understood', lang) },
  ] as const;
  const tier = (v: number) => (v >= 0.75 ? 'bright' : v >= 0.45 ? 'steady' : 'pulse');
  return (
    <div className="sbu" role="group" aria-label={t('sbu_group', lang)}>
      {rings.map((r) => (
        // The reading lived only in a `title=` on the ring, which is hover-only
        // and was never announced: the group label names the three axes but
        // carried none of their numbers. Each ring now speaks its own value.
        <div
          key={r.k}
          className={`ring ring-${tier(r.v)}`}
          role="img"
          aria-label={t('sbu_ring', lang, { name: r.name, v: r.v.toFixed(2) })}
        >
          <span className="ring-k" aria-hidden="true">{r.k}</span>
          <span className="ring-v tnum" aria-hidden="true">{r.v.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

export function QuotaMeter({ cUsed, cCap, lUsed, lCap }: { cUsed: number; cCap: number; lUsed: number; lCap: number }) {
  const { lang } = useSession();
  const low = cUsed / Math.max(1, cCap) > 0.8 || lUsed / Math.max(1, lCap) > 0.8;
  return (
    // `role="meter"` without aria-valuenow/min/max is invalid ARIA — the role
    // promises a reading and assistive tech had none to announce. The value is
    // the compact tier's usage; the label names both tiers.
    <div
      className={`quota${low ? ' quota-low' : ''}`}
      role="meter"
      aria-valuenow={cUsed}
      aria-valuemin={0}
      aria-valuemax={cCap}
      aria-label={t('quota_label', lang, { c: cUsed, cc: cCap, l: lUsed, lc: lCap })}
    >
      <span className="tnum">
        C {cUsed}/{cCap}
      </span>
      <span className="quota-bar" aria-hidden="true">
        <i style={{ width: `${Math.min(100, (cUsed / Math.max(1, cCap)) * 100)}%` }} />
      </span>
      <span className="tnum">
        L {lUsed}/{lCap}
      </span>
    </div>
  );
}

export function CiteChips({ cites, onOpen }: { cites: string[]; onOpen?: (id: string) => void }) {
  const { lang } = useSession();
  if (!cites || cites.length === 0) return <span className="cites-warn">{t('no_cites', lang)}</span>;
  return (
    <span className="cites">
      {cites.map((c) => (
        <button key={c} type="button" className="cite" translate="no" onClick={() => onOpen?.(c)} aria-label={t('source_n', lang, { n: c })}>
          {c}
        </button>
      ))}
    </span>
  );
}

export function ErrorNote({ code, msg, retryable, onRetry }: { code: string; msg: string; retryable: boolean; onRetry?: () => void }) {
  const { lang } = useSession();
  return (
    <div className="error-note" role="alert" aria-live="polite">
      <strong>{msg}</strong>
      <span className="error-code" translate="no">
        {code}
      </span>
      {retryable && onRetry && (
        <button type="button" className="btn btn-small" style={{ minHeight: 44 }} onClick={onRetry}>
          {t('retry', lang)}
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
      {action}
    </div>
  );
}

import { useCountdown } from '../lib/useCountdown';

export function CountdownRing({ endsAt }: { endsAt?: string }) {
  const { lang } = useSession();
  const remain = useCountdown(endsAt);
  const mm = Math.floor(remain / 60);
  const ss = String(remain % 60).padStart(2, '0');
  return (
    <span className="countdown tnum" role="timer" aria-label={t('countdown_left', lang, { n: remain })}>
      {mm}:{ss}
    </span>
  );
}
