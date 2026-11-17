import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ApiFailure, api, type Lang } from '../lib/api';
import { useSession } from '../lib/session';
import { ErrorNote, HatChip } from '../components/ui';
import { t } from '../lib/i18n';
import { Reveal } from '../lib/motion';

const HATS = [
  { key: 'NOVA_NOVICE', label: 'NOVA_NOVICE' },
  { key: 'NOVA_SKEPTIC', label: 'NOVA_SKEPTIC' },
  { key: 'NOVA_CURIOUS', label: 'NOVA_CURIOUS' },
  { key: 'NOVA_EXAMINER', label: 'NOVA_EXAMINER' },
] as const;

const MAX_TURNS = 8;

export function Solo() {
  const { lang, learnerId, metrics } = useSession();
  const [sid, setSid] = useState('');
  const [hat, setHat] = useState('NOVA_NOVICE');
  const [thread, setThread] = useState<Array<{ who: string; text: string }>>([]);
  const [text, setText] = useState('');
  const [progress, setProgress] = useState(0);
  const [invite, setInvite] = useState<{ deepLink: string; code: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setErr(null);
    try {
      const r = await api.soloStart('binary_search', (lang as Lang) ?? 'darija', learnerId);
      setSid(r.sessionId);
      setHat(r.hat);
      setThread([{ who: r.hat, text: r.probe }]);
    } catch (e) {
      const f = e as ApiFailure;
      setErr((f.body?.user_msg?.[lang]) ?? 'Solo failed to start.');
    }
  };

  const turn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !sid) return;
    const mine = text.trim();
    setText('');
    setThread((t) => [...t, { who: learnerId, text: mine }]); // optimistic learner bubble
    setBusy(true);
    try {
      const r = await api.soloTurn(sid, learnerId, mine, lang);
      setThread((t) => [...t, { who: hat, text: r.novaTurn }]); // Nova's reply
      setProgress(r.progress);
    } catch (e) {
      const f = e as ApiFailure;
      setErr((f.body?.user_msg?.[lang]) ?? 'Turn failed.');
    } finally {
      setBusy(false);
    }
  };

  const usage = metrics?.quotaUsage.find((u) => u.sessionId === sid);
  const turnsDone = Math.round(progress * MAX_TURNS);

  return (
    <div className="page narrow solo">
      {!sid ? (
        <Reveal as="section" className="card solo-start" index={0}>
          <h1>{t('solo_title', lang)}</h1>
          <p>{t('solo_start_copy', lang)}</p>
          <button type="button" className="btn" style={{ minHeight: 44 }} onClick={start} disabled={!learnerId}>
            {learnerId ? t('solo_start', lang) : t('solo_enter', lang)}
          </button>
        </Reveal>
      ) : (
        <>
          <div className="solo-top">
            <div className="hat-row" role="group" aria-label="Nova hat">
              {HATS.map((h) => (
                <button
                  key={h.key}
                  type="button"
                  className={`hatchip${hat === h.key ? ' hatchip-on' : ''}`}
                  aria-pressed={hat === h.key}
                  onClick={() => api.soloHat(sid, h.key).then((r) => setHat(r.hat)).catch(() => undefined)}
                  translate="no"
                >
                  {h.key.replace('NOVA_', '')}
                </button>
              ))}
            </div>
            <div className="solo-progress">
              <div className="progress" role="progressbar" aria-valuenow={turnsDone} aria-valuemin={0} aria-valuemax={MAX_TURNS}>
                <i style={{ width: `${(turnsDone / MAX_TURNS) * 100}%` }} />
              </div>
              <p className="hint tnum">{t('solo_progress', lang, { n: turnsDone })}</p>
            </div>
          </div>

          <ol className="thread solo-thread" aria-label="Nova and teacher thread">
            {thread.map((m, i) => (
              <li key={i} className={m.who === learnerId ? 'me' : 'nova'}>
                {m.who !== learnerId && <HatChip hat={m.who} />}
                <p>{m.text}</p>
              </li>
            ))}
            {busy && <li className="nova solo-typing" aria-live="polite"><span className="dot" /><span className="dot" /><span className="dot" /></li>}
          </ol>

          {thread.length === 1 && !busy && <p className="muted solo-teach">{t('solo_teacher', lang)}</p>}

          <form onSubmit={turn} className="row solo-composer">
            <label className="visually-hidden" htmlFor="solo-text">
              {t('solo_send', lang)}
            </label>
            <input id="solo-text" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('solo_send', lang)} />
            <button type="submit" className="btn" style={{ minHeight: 44 }} disabled={!text.trim() || busy}>
              {t('solo_send_short', lang)}
            </button>
          </form>

          {usage && (
            <p className="muted tnum solo-budget">
              {t('solo_budget', lang, { n: turnsDone })} · {usage.cUsed}/{MAX_TURNS} compact · {usage.lUsed} larger
            </p>
          )}

          {thread.length > 1 && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => api.soloInvite(sid).then((r) => setInvite(r)).catch(() => undefined)}
            >
              {t('solo_invite', lang)}
            </button>
          )}
          {invite && (
            <div className="card stack solo-invite">
              <p translate="no">
                {invite.deepLink} · {t('solo_code', lang)} <strong className="tnum">{invite.code}</strong>
              </p>
              <QRCodeSVG value={invite.deepLink} size={140} role="img" aria-label={t('solo_qr', lang)} />
            </div>
          )}
          {err && <ErrorNote code="SOLO" msg={err} retryable onRetry={() => setErr(null)} />}
        </>
      )}
    </div>
  );
}
