import { useEffect, useState } from 'react';
import { clockSkew } from './api';

/**
 * Remaining seconds from an ISO `windowEndsAt`, tick 1 s.
 *
 * The server deliberately omits a `now` field (it keeps ETags stable), so the device
 * clock cannot be trusted on its own: a device 30 s behind renders a timer that never
 * reaches 0. `api.ts` learns the offset from the `Date` response header; use it here.
 */
export function useCountdown(target?: string): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!target) return 0;
  return Math.max(0, Math.round((new Date(target).getTime() - (now - clockSkew())) / 1000));
}
