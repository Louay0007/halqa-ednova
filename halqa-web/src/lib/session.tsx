import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { DegradationMode, Lang, Metrics } from '../lib/api';
import { api, tokenStore } from '../lib/api';
import { RTL } from '../lib/i18n';

interface SessionCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  learnerId: string;
  setLearnerId: (id: string) => void;
  circleId: string;
  setCircleId: (id: string) => void;
  sessionId: string;
  setSessionId: (id: string) => void;
  metrics: Metrics | null;
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
  const [sessionId, setSessionIdState] = useState(() => sessionStorage.getItem('halqa.session') ?? '');
  const [metrics, setMetrics] = useState<Metrics | null>(null);

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
  }, []);
  const setSessionId = useCallback((id: string) => {
    sessionStorage.setItem('halqa.session', id);
    setSessionIdState(id);
  }, []);
  const login = useCallback(
    (token: string, id: string) => {
      tokenStore.set(token);
      setLearnerId(id);
    },
    [setLearnerId],
  );
  const logout = useCallback(() => {
    tokenStore.clear();
    setLearnerId('');
  }, [setLearnerId]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL.includes(lang) ? 'rtl' : 'ltr';
  }, [lang]);

  useEffect(() => {
    if (!tokenStore.get()) return;
    let dead = false;
    const tick = () => {
      api
        .metrics(sessionId || undefined)
        .then((r) => {
          if (!dead) setMetrics(r.data);
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

  return (
    <Ctx.Provider
      value={{ lang, setLang, learnerId, setLearnerId, circleId, setCircleId, sessionId, setSessionId, metrics, authed: tokenStore.get().length > 0, login, logout }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function degradationCopy(mode: DegradationMode, lang: Lang): string | null {
  if (mode === 'green') return null;
  const map: Record<Exclude<DegradationMode, 'green'>, Record<Lang, string>> = {
    orange: {
      en: 'Nova is queuing deeper answers — peers keep going',
      fr: 'Nova met les réponses en file — les pairs continuent',
      ar: 'Nova يرتّب الإجابات — الزملاء يواصلون',
      darija: 'Nova يحط الإجابات في الصف — الزملاء يكمّلو',
    },
    red: {
      en: 'Quota out — simplified answers only',
      fr: 'Quota épuisé — réponses simplifiées',
      ar: 'انتهت الحصة — إجابات مبسطة فقط',
      darija: 'وفات الكوطا — إجابات مختصرة برك',
    },
    black: {
      en: 'Offline — circle tools still work',
      fr: 'Hors ligne — les outils du cercle marchent',
      ar: 'دون اتصال — أدوات الحلقة تعمل',
      darija: 'بلا connexion — أدوات الحلقة تخدم',
    },
  };
  return map[mode][lang];
}
