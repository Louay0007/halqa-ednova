import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ApiFailure, api, type ContextMode, type Lang } from '../lib/api';
import { useSession } from '../lib/session';
import { ErrorNote } from '../components/ui';
import { Reveal } from '../lib/motion';
import { stepLabel, t, topicLabel } from '../lib/i18n';

const TOPICS = ['binary_search', 'fractions'] as const;
const CONTEXTS: ContextMode[] = ['class', 'study', 'community', 'workshop', 'program', 'solo'];
const LANGS: Lang[] = ['fr', 'darija', 'ar', 'en'];

export function CirclesNew() {
  const nav = useNavigate();
  const { lang, setCircleId, setJoinCode, setSessionId, login } = useSession();
  const [topic, setTopic] = useState<string>('binary_search');
  const [context, setContext] = useState<ContextMode>('study');
  const [circleLang, setCircleLang] = useState<Lang>('darija');
  const [windowS, setWindowS] = useState(45);
  const [nick, setNick] = useState('');
  const [counts, setCounts] = useState<Record<string, Record<string, number>>>({});
  /** Agenda comes from the selected context's config, the same source Lobby uses.
   *  It used to be hardcoded, so a context that drops a step still advertised it. */
  const [agenda, setAgenda] = useState<Array<{ id: string; kind: string; plannedS?: number }>>([]);
  const [result, setResult] = useState<{ circleId: string; joinCode: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.kbStats().catch(() => undefined);
    for (const tp of TOPICS) {
      api.kbChunks(tp).then((r) => {
        const unique = new Map<string, string>();
        for (const ch of r.data.chunks) {
          if (!unique.has(ch.chunk_id)) unique.set(ch.chunk_id, ch.lang);
        }
        const c: Record<string, number> = {};
        for (const l of unique.values()) c[l] = (c[l] ?? 0) + 1;
        setCounts((prev) => ({ ...prev, [tp]: c }));
      }).catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    let dead = false;
    api
      .contextConfig(context)
      .then((r) => {
        if (!dead) setAgenda(r.data.agenda);
      })
      .catch(() => {
        if (!dead) setAgenda([]);
      });
    return () => {
      dead = true;
    };
  }, [context]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const r = await api.circleCreate({ topic, context, lang: circleLang, windowS, hostNickname: nick.trim() });
      sessionStorage.setItem('halqa.context', context);
      sessionStorage.setItem('halqa.nick', nick.trim());
      login(r.token, r.hostLearnerId);
      setCircleId(r.circleId);
      setJoinCode(r.joinCode);
      setSessionId('');
      setResult({ circleId: r.circleId, joinCode: r.joinCode });
    } catch (e) {
      const f = e as ApiFailure;
      setErr(f.body?.user_msg?.[lang] ?? '—');
    }
  };

  if (result) {
    const url = `${location.origin}/circles/join?code=${result.joinCode}`;
    return (
      <div className="page narrow result-page">
        <Reveal as="header" className="result-head" index={0}>
          <h1>{t('circle_ready', lang)}</h1>
          <p className="muted">{t('share_hint', lang)}</p>
        </Reveal>
        <Reveal as="section" className="card code-big result-card" index={1} aria-live="polite">
          <div className="code tnum" translate="no">
            {result.joinCode}
          </div>
          <QRCodeSVG value={url} size={176} role="img" aria-label={t('result_qr', lang)} />
          <p className="hint" translate="no">
            {url}
          </p>
          <div className="cta-row">
            <button
              type="button"
              className="btn"
              style={{ minHeight: 44 }}
              onClick={() => {
                navigator.clipboard?.writeText(result.joinCode).catch(() => undefined);
                setCopied(true);
              }}
            >
              {copied ? t('copied', lang) : t('code_copy', lang)}
            </button>
            <button type="button" className="btn btn-ghost" style={{ minHeight: 44 }} onClick={() => nav(`/c/${result.circleId}`)}>
              {t('open_lobby', lang)}
            </button>
          </div>
          {copied && (
            <p className="hint ok" role="status">
              {t('copied', lang)}
            </p>
          )}
        </Reveal>
      </div>
    );
  }

  const totalChunks = (tp: string) => Object.values(counts[tp] ?? {}).reduce((a, b) => a + b, 0);

  return (
    <div className="page narrow new-circle">
      <Reveal as="header" className="duo-head" index={0}>
        <h1>{t('new_circle', lang)}</h1>
        <p className="muted">{t('new_circle_sub', lang)}</p>
      </Reveal>
      <form onSubmit={create} className="stack">
        <Reveal as="fieldset" className="card choice-group" index={1}>
          <legend>{t('topic', lang)}</legend>
          <div className="choice-row">
            {TOPICS.map((tp) => (
              <label key={tp} className={`choice-card${topic === tp ? ' choice-on' : ''}`}>
                <input type="radio" name="topic" value={tp} checked={topic === tp} onChange={() => setTopic(tp)} />
                <span className="choice-title">{topicLabel(tp, lang)}</span>
                <span className="chunk-chips tnum">
                  {(Object.entries(counts[tp] ?? {})).map(([l, n]) => (
                    <span key={l} className="chunk-chip" translate="no">{l} {n}</span>
                  ))}
                  {totalChunks(tp) > 0 && <span className="chunk-chip total">{totalChunks(tp)} {t('chunks', lang)}</span>}
                </span>
              </label>
            ))}
          </div>
        </Reveal>

        <Reveal as="fieldset" className="card choice-group" index={2}>
          <legend>{t('context', lang)}</legend>
          <div className="pill-row" role="radiogroup" aria-label={t('context', lang)}>
            {CONTEXTS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={context === c} className={`pill${context === c ? ' pill-on' : ''}`} onClick={() => setContext(c)} translate="no">
                {c}
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal as="fieldset" className="card choice-group" index={3}>
          <legend>{t('circle_lang', lang)}</legend>
          <div className="pill-row" role="radiogroup" aria-label={t('circle_lang', lang)}>
            {LANGS.map((l) => (
              <button key={l} type="button" role="radio" aria-checked={circleLang === l} className={`pill${circleLang === l ? ' pill-on' : ''}`} onClick={() => setCircleLang(l)} translate="no">
                {l === 'fr' ? 'français' : l === 'darija' ? 'دارجة' : l === 'ar' ? 'العربية' : 'English'}
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal as="section" className="card window-card" index={4}>
          <label htmlFor="win">
            {t('peer_window', lang)} · <strong className="tnum">{windowS}s</strong>
          </label>
          <input id="win" type="range" min={30} max={90} step={5} value={windowS} onChange={(e) => setWindowS(Number(e.target.value))} />
          <p className="hint">{t('peer_window_hint', lang)}</p>
        </Reveal>

        <Reveal as="section" className="card agenda-preview" index={5}>
          <h2>{t('agenda_preview', lang)}</h2>
          <ol className="agenda">
            {/* Only steps this context actually runs: one source of truth with Lobby. */}
            {agenda.map((s, i) => (
              <li key={s.id}>
                <span className="agenda-tick tnum">{i + 1}</span>
                <span>{stepLabel(s.kind, lang)}</span>
              </li>
            ))}
          </ol>
        </Reveal>

        <div className="field">
          <label htmlFor="host">{t('your_nick', lang)}</label>
          <input id="host" name="nickname" maxLength={24} required spellCheck={false} autoComplete="nickname" value={nick} onChange={(e) => setNick(e.target.value)} placeholder="Host-Rim…" />
        </div>
        {err && <ErrorNote code="CIRCLE_CREATE" msg={err} retryable onRetry={() => setErr(null)} />}
        <button type="submit" className="btn" style={{ minHeight: 44 }} disabled={nick.trim().length === 0}>
          {t('create_circle', lang)}
        </button>
        <p>
          <Link to="/circles/join">{t('have_code', lang)}</Link>
        </p>
      </form>
    </div>
  );
}
