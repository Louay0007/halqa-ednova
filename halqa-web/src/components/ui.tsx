import './ui.css';

export function HatChip({ hat }: { hat: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    Mediator: { label: 'Mediator · وسيط', cls: 'hat-mediator' },
    Teammate: { label: 'Teammate · زميل', cls: 'hat-teammate' },
    Tutor: { label: 'Tutor · معلّم', cls: 'hat-tutor' },
    Facilitator: { label: 'Facilitator · مسيّر', cls: 'hat-facilitator' },
    NOVA_NOVICE: { label: 'Nova · curious', cls: 'hat-teammate' },
    NOVA_SKEPTIC: { label: 'Nova · skeptic', cls: 'hat-mediator' },
    NOVA_CURIOUS: { label: 'Nova · curious', cls: 'hat-teammate' },
    NOVA_EXAMINER: { label: 'Nova · examiner', cls: 'hat-facilitator' },
    NOVA: { label: 'Nova', cls: 'hat-tutor' },
  };
  const v = map[hat] ?? { label: hat, cls: 'hat-tutor' };
  return (
    <span className={`hat ${v.cls}`} translate="no">
      ★ {v.label}
    </span>
  );
}

export function SbuRings({ S, B, U }: { S: number; B: number; U: number }) {
  const rings = [
    { k: 'S', v: S, name: 'Structured' },
    { k: 'B', v: B, name: 'Balanced' },
    { k: 'U', v: U, name: 'Understood' },
  ] as const;
  const tier = (v: number) => (v >= 0.75 ? 'bright' : v >= 0.45 ? 'steady' : 'pulse');
  return (
    <div className="sbu" role="group" aria-label="Circle health S B U">
      {rings.map((r) => (
        <div key={r.k} className={`ring ring-${tier(r.v)}`} title={`${r.name}: ${r.v.toFixed(2)}`}>
          <span className="ring-k">{r.k}</span>
          <span className="ring-v tnum">{r.v.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

export function QuotaMeter({ cUsed, cCap, lUsed, lCap }: { cUsed: number; cCap: number; lUsed: number; lCap: number }) {
  const low = cUsed / Math.max(1, cCap) > 0.8 || lUsed / Math.max(1, lCap) > 0.8;
  return (
    <div className={`quota${low ? ' quota-low' : ''}`} role="meter" aria-label={`Compact ${cUsed} of ${cCap}, Larger ${lUsed} of ${lCap}`}>
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
  if (!cites || cites.length === 0) return <span className="cites-warn">no cites — file it</span>;
  return (
    <span className="cites">
      {cites.map((c) => (
        <button key={c} type="button" className="cite" translate="no" onClick={() => onOpen?.(c)} aria-label={`Source ${c}`}>
          {c}
        </button>
      ))}
    </span>
  );
}

export function ErrorNote({ code, msg, retryable, onRetry }: { code: string; msg: string; retryable: boolean; onRetry?: () => void }) {
  return (
    <div className="error-note" role="alert" aria-live="polite">
      <strong>{msg}</strong>
      <span className="error-code" translate="no">
        {code}
      </span>
      {retryable && onRetry && (
        <button type="button" className="btn btn-small" onClick={onRetry}>
          Retry
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
  const remain = useCountdown(endsAt);
  const mm = Math.floor(remain / 60);
  const ss = String(remain % 60).padStart(2, '0');
  return (
    <span className="countdown tnum" role="timer" aria-label={`${remain} seconds left for peers`}>
      {mm}:{ss}
    </span>
  );
}
