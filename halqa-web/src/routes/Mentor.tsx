import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiFailure, api } from '../lib/api';
import { useSession } from '../lib/session';
import { ErrorNote } from '../components/ui';
import { Reveal, useSectionReveal } from '../lib/motion';
import { t } from '../lib/i18n';

export function Mentor() {
  const [params] = useSearchParams();
  const { lang, learnerId, sessionId } = useSession();
  const [rawCode, setRawCode] = useState(params.get('circleId') ?? '');
  const [circleId, setCircleId] = useState('');
  const [joined, setJoined] = useState(false);
  const [note, setNote] = useState('');
  const [notes, setNotes] = useState<string[]>([]);
  const [brief, setBrief] = useState<{ brief: string; words: number } | null>(null);
  const [briefBusy, setBriefBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /** Mentors are handed the 6-character code, not the internal id, so resolve it
   *  first — the join endpoint is keyed by the Mongo `_id`. A full 24-hex id is
   *  passed through unchanged for deep links that already have one. */
  const resolve = async (raw: string): Promise<string> => {
    const v = raw.trim();
    if (/^[0-9a-f]{24}$/i.test(v)) return v;
    const r = await api.circleByCode(v);
    return r.data.circleId;
  };

  const join = async () => {
    setErr(null);
    try {
      const id = await resolve(rawCode);
      await api.mentorJoin(id, learnerId);
      setCircleId(id);
      setJoined(true);
    } catch (e) {
      setErr(((e as ApiFailure).body?.user_msg?.[lang]) ?? '—');
    }
  };

  const sendNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    const v = note.trim();
    setErr(null);
    try {
      await api.mentorNote(circleId.trim(), learnerId, v, sessionId || undefined);
      setNotes((n) => [v, ...n]);
      setNote('');
    } catch (e) {
      setErr(((e as ApiFailure).body?.user_msg?.[lang]) ?? '—');
    }
  };

  const loadBrief = async () => {
    setBriefBusy(true);
    setErr(null);
    try {
      const r = await api.mentorBrief(circleId.trim(), sessionId);
      setBrief(r.data);
    } catch (e) {
      setErr(((e as ApiFailure).body?.user_msg?.[lang]) ?? '—');
    } finally {
      setBriefBusy(false);
    }
  };

  const reveal = useSectionReveal(3);
  return (
    <div className="page narrow mentor">
      <Reveal as="header" className="duo-head" index={0}>
        <h1>{t('mentor_title', lang)}</h1>
        <p className="observer">{t('mentor_invisible', lang)}</p>
      </Reveal>

      <Reveal as="section" className="card choice-group" index={1}>
        <label htmlFor="mcircle">{t('code_label', lang)}</label>
        <div className="row">
          {/* The placeholder sat in a field narrower than itself, so it rendered
              as "C-…" — a code that looks truncated before you type anything.
              And a disabled Join said nothing about the one thing blocking it. */}
          <input
            id="mcircle"
            value={rawCode}
            onChange={(e) => setRawCode(e.target.value)}
            placeholder={t('mentor_code_placeholder', lang)}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            translate="no"
          />
          {!joined && (
            <button type="button" className="btn btn-small" style={{ minHeight: 44 }} onClick={join} disabled={!rawCode.trim() || !learnerId}>
              {t('mentor_join', lang)}
            </button>
          )}
        </div>
        {!joined && !learnerId && <p className="hint">{t('mentor_code_needs_account', lang)}</p>}
      </Reveal>

      {joined && (
        <>
          <Reveal as="section" className="card mentor-brief" index={2}>
            <h2>{t('mentor_brief', lang)}</h2>
            {brief ? (
              <>
                <p translate="no">{brief.brief}</p>
                <p className="hint tnum">{brief.words} {t('words', lang)}</p>
              </>
            ) : (
              <>
                <button type="button" className="btn btn-ghost btn-small" style={{ minHeight: 44 }} onClick={loadBrief} disabled={briefBusy || !sessionId}>
                  {briefBusy ? '…' : t('mentor_load', lang)}
                </button>
                {/* `GET /mentor/brief` needs a live session id; without one the
                    request can only fail, so say why instead of letting it 400. */}
                {!sessionId && <p className="hint">{t('mentor_need_session', lang)}</p>}
              </>
            )}
          </Reveal>

          <form onSubmit={sendNote} className="card stack" {...reveal}>
            <label htmlFor="mnote">{t('mentor_note_label', lang)}</label>
            <textarea id="mnote" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('mentor_note_placeholder', lang)} />
            <button type="submit" className="btn btn-small" style={{ minHeight: 44 }} disabled={!note.trim()}>
              {t('mentor_send', lang)}
            </button>
          </form>

          {notes.length > 0 && (
            <Reveal as="section" className="card" index={4}>
              <h2>{t('mentor_notes', lang)}</h2>
              <ul className="mentor-notes">
                {notes.map((n, i) => <li key={i} className="mentor-note" translate="no">{n}</li>)}
              </ul>
            </Reveal>
          )}
        </>
      )}

      {err && <ErrorNote code="MENTOR" msg={err} retryable onRetry={() => setErr(null)} />}
      <p className="muted aggregates">{t('mentor_aggregates', lang)}</p>
    </div>
  );
}
