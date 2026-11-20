import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { DegradationMode, Lang } from '../lib/api';
import { api, setUnauthorizedHandler, tokenStore } from '../lib/api';
import { RTL } from '../lib/i18n';

export interface SessionStatus {
  degradation: DegradationMode;
  quota: { cUsed: number; lUsed: number; cCap: number; lCap: number } | null;
}

interface SessionCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  learnerId: string;
  setLearnerId: (id: string) => void;
  circleId: string;
  setCircleId: (id: string) => void;
  /** The 6-character code learners type to join. The Mongo `_id` is NOT joinable —
   *  `GET /circles/by-code/:code` only accepts this one, so anything a peer scans
   *  or copies (header chip, QR) has to use it. */
  joinCode: string;
  setJoinCode: (code: string) => void;
  sessionId: string;
  setSessionId: (id: string) => void;
  /** Degradation mode and this session's quota — what a learner may see. */
  status: SessionStatus | null;
  authed: boolean;
  login: (token: string, learnerId: string) => void;
  logout: () => void;
}

const Ctx = createContext<SessionCtx | null>(null);

export function useSession(): SessionCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession outside provider');
  return v;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (sessionStorage.getItem('halqa.lang') as Lang) || 'fr');
  const [learnerId, setLearnerIdState] = useState(() => sessionStorage.getItem('halqa.learner') ?? '');
  const [circleId, setCircleIdState] = useState(() => sessionStorage.getItem('halqa.circle') ?? '');
  const [joinCode, setJoinCodeState] = useState(() => sessionStorage.getItem('halqa.joincode') ?? '');
  const [sessionId, setSessionIdState] = useState(() => sessionStorage.getItem('halqa.session') ?? '');
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [authed, setAuthed] = useState(() => tokenStore.get().length > 0);

  const setLang = useCallback((l: Lang) => {
    sessionStorage.setItem('halqa.lang', l);
    setLangState(l);
  }, []);
  const setLearnerId = useCallback((id: string) => {
    sessionStorage.setItem('halqa.learner', id);
    setLearnerIdState(id);
  }, []);
  const setCircleId = useCallback((id: string) => {
    sessionStorage.setItem('halqa.circle', id);
    setCircleIdState(id);
    // A stale code would be worse than none: peer QRs and the copy chip both read it.
    if (!id) {
      sessionStorage.removeItem('halqa.joincode');
      setJoinCodeState('');
    }
  }, []);
  const setJoinCode = useCallback((code: string) => {
    const v = code.trim().toUpperCase();
    if (v) sessionStorage.setItem('halqa.joincode', v);
    else sessionStorage.removeItem('halqa.joincode');
    setJoinCodeState(v);
  }, []);
  const setSessionId = useCallback((id: string) => {
    sessionStorage.setItem('halqa.session', id);
    setSessionIdState(id);
  }, []);
  const login = useCallback(
    (token: string, id: string) => {
      tokenStore.set(token);
      setLearnerId(id);
      setAuthed(true);
    },
    [setLearnerId],
  );
  const logout = useCallback(() => {
    tokenStore.clear();
    setLearnerId('');
    setAuthed(false);
  }, [setLearnerId]);

  // Let the API client clear auth state the moment the server rejects a token,
  // instead of leaving a dead token in place until the tab is closed.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      tokenStore.clear();
      setLearnerId('');
      setAuthed(false);
    });
  }, [setLearnerId]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL.includes(lang) ? 'rtl' : 'ltr';
  }, [lang]);

  /*
   * The banner and the quota meter used to poll `GET /metrics`, which is
   * `@Roles('mentor','admin')`. A learner therefore 403'd on every tick: the
   * degradation banner could never leave green, and the budget card never
   * rendered because the quota list was always empty. This polls the
   * learner-scoped route instead, which is the same two fields.
   */
  useEffect(() => {
    if (!tokenStore.get() || !sessionId) return;
    let dead = false;
    const tick = () => {
      api
        .sessionStatus(sessionId)
        .then((r) => {
          if (!dead) setStatus(r.data);
        })
        .catch(() => undefined);
    };
    tick();
    const t = setInterval(tick, 5000);
    const onVis = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      dead = true;
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [sessionId]);

  const value = useMemo(
    () => ({ lang, setLang, learnerId, setLearnerId, circleId, setCircleId, joinCode, setJoinCode, sessionId, setSessionId, status, authed, login, logout }),
    [lang, setLang, learnerId, setLearnerId, circleId, setCircleId, joinCode, setJoinCode, sessionId, setSessionId, status, authed, login, logout],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
    </Ctx.Provider>
  );
}

/** Banner copy is a pure lookup; re-exported so call sites keep
 *  importing it from '../lib/session' (spec §3.2). Listed in
 *  .oxlintrc.json → react/only-export-components.allowExportNames. */
// eslint-disable-next-line react-refresh/only-export-components
export { degradationCopy } from './degradation-copy';
