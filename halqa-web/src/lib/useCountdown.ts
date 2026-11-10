import { useEffect, useState } from 'react';

/** Remaining seconds from an ISO windowEndsAt, client clock, tick 1 s. */
export function useCountdown(target?: string): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!target) return 0;
  return Math.max(0, Math.round((new Date(target).getTime() - now) / 1000));
}
