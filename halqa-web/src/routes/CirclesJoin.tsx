import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiFailure, api } from '../lib/api';
import { useSession } from '../lib/session';
import { ErrorNote } from '../components/ui';
import { Reveal } from '../lib/motion';
import { t } from '../lib/i18n';

/** R5 — 6-box code entry. Forgiving: auto-uppercase, spaces/dashes stripped,
 *  paste-anything normalizes, auto-advance + backspace. ?code= prefills. */
export function CirclesJoin() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { lang, learnerId, setCircleId, login } = useSession();
  const initial = (params.get('code') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  const [digits, setDigits] = useState<string[]>(Array.from({ length: 6 }, (_, i) => initial[i] ?? ''));
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const [nick, setNick] = useState('');
  const [preview, setPreview] = useState<{ circleId: string; topic: string; members: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const code = digits.join('');

  const lookup = async (c: string) => {
    setErr(null);
    setPreview(null);
    if (c.trim().length < 4) return;
    try {
      const r = await api.circleByCode(c.trim());
      setPreview(r.data);
    } catch (e) {
      const f = e as ApiFailure;
      setErr(f.body?.user_msg?.[lang] ?? '—');
    }
  };

  useEffect(() => {
    if (initial.length === 6) void lookup(initial);
  }, []);

  const put = (i: number, raw: string) => {
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!clean) {
      const next = [...digits];
      next[i] = '';
      setDigits(next);
      return;
    }
    // paste of a full code into any box fills all six
    if (clean.length > 1) {
      const next = Array.from({ length: 6 }, (_, k) => clean[k] ?? '');
      setDigits(next);
      refs.current[Math.min(5, i + clean.length - 1)]?.focus();
      void lookup(clean.slice(0, 6));
      return;
    }
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (i < 5) refs.current[i + 1]?.focus();
    if (next.every(Boolean)) void lookup(next.join(''));
  };

  const onKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      const next = [...digits];
      next[i - 1] = '';
      setDigits(next);
      refs.current[i - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus();
  };

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nick.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const id = preview?.circleId ?? code.trim();
      const r = await api.circleJoin(id, nick.trim(), learnerId || undefined);
      sessionStorage.setItem('halqa.nick', nick.trim());
      login(r.token, r.learnerId);
      setCircleId(id);
      nav(`/c/${id}`);
    } catch (e) {
      const f = e as ApiFailure;
      setErr(f.body?.user_msg?.[lang] ?? '—');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page narrow join-circle">
      <Reveal as="header" className="duo-head" index={0}>
        <h1>{t('join_circle', lang)}</h1>
        <p className="muted">{t('join_sub', lang)}</p>
      </Reveal>
      <form onSubmit={join} className="stack">
        <Reveal as="section" className="card choice-group" index={1}>
          <label htmlFor="code-0">{t('code_label', lang)}</label>
          <div className="code-boxes" role="group" aria-label={t('code_label', lang)}>
            {digits.map((d, i) => (
              <input
                key={i}
                id={`code-${i}`}
                ref={(el) => { refs.current[i] = el; }}
                className="code-box tnum"
                value={d}
                onChange={(e) => put(i, e.target.value)}
                onKeyDown={(e) => onKey(i, e)}
                maxLength={6}
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                spellCheck={false}
                inputMode="text"
                translate="no"
                aria-label={`${t('code_label', lang)} ${i + 1}`}
              />
            ))}
          </div>
          <div className="code-actions">
            <button type="button" className="btn btn-ghost btn-small" style={{ minHeight: 44 }} disabled={code.trim().length < 4} onClick={() => lookup(code)}>
              {t('check_code', lang)}
            </button>
            {preview && (
              <span className="hint ok" aria-live="polite">
                ✓ <span translate="no">{preview.topic}</span> · {preview.members} {t('members', lang).toLowerCase()}
              </span>
            )}
          </div>
        </Reveal>

        <Reveal as="section" className="card choice-group" index={2}>
          <label htmlFor="jnick">{t('your_nick', lang)}</label>
          <input id="jnick" name="nickname" maxLength={24} required spellCheck={false} autoComplete="nickname" value={nick} onChange={(e) => setNick(e.target.value)} placeholder="Peer-Yassine…" />
        </Reveal>

        {err && <ErrorNote code="JOIN_FAILED" msg={err} retryable onRetry={() => setErr(null)} />}
        <button type="submit" className="btn" style={{ minHeight: 44 }} disabled={busy || !nick.trim() || (!preview && code.trim().length < 4)}>
          {busy ? t('joining', lang) : t('join_arrow', lang)}
        </button>
      </form>
    </div>
  );
}
