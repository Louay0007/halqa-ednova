import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiFailure, api } from '../lib/api';
import { useSession } from '../lib/session';
import { ErrorNote } from '../components/ui';

export function Mentor() {
  const [params] = useSearchParams();
  const { lang, learnerId, sessionId } = useSession();
  const [circleId, setCircleId] = useState(params.get('circleId') ?? '');
  const [joined, setJoined] = useState(false);
  const [note, setNote] = useState('');
  const [brief, setBrief] = useState<{ brief: string; words: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const join = async () => {
    setErr(null);
    try {
      await api.mentorJoin(circleId.trim(), learnerId);
      setJoined(true);
    } catch (e) {
      const f = e as ApiFailure;
      setErr(f.body?.user_msg?.[lang] ?? 'Join failed.');
    }
  };
  const sendNote = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.mentorNote(circleId.trim(), learnerId, note.trim(), sessionId || undefined);
      setNote('');
    } catch (e) {
      const f = e as ApiFailure;
      setErr(f.body?.user_msg?.[lang] ?? 'Note failed.');
    }
  };
  const loadBrief = async () => {
    try {
      const r = await api.mentorBrief(circleId.trim(), sessionId);
      setBrief(r.data);
    } catch (e) {
      const f = e as ApiFailure;
      setErr(f.body?.user_msg?.[lang] ?? 'Brief failed.');
    }
  };

  return (
    <div className="page narrow">
      <h1>Mentor seat</h1>
      <p className="observer">You are invisible — no credits, no turns. Aggregate view only.</p>
      <div className="field">
        <label htmlFor="mcircle">Circle id</label>
        <input id="mcircle" value={circleId} onChange={(e) => setCircleId(e.target.value)} placeholder="C-…" translate="no" />
      </div>
      {!joined ? (
        <button type="button" className="btn" onClick={join} disabled={!circleId || !learnerId}>
          Join as observer
        </button>
      ) : (
        <div className="stack">
          <section className="card plum">
            <h2>Brief (≤60 words)</h2>
            {brief ? (
              <p>{brief.brief}</p>
            ) : (
              <button type="button" className="btn btn-ghost btn-small" onClick={loadBrief}>
                Load brief
              </button>
            )}
          </section>
          <form onSubmit={sendNote} className="card stack">
            <label htmlFor="mnote">Gentle note (≤500)</label>
            <textarea id="mnote" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            <button type="submit" className="btn btn-small" disabled={!note.trim()}>
              Send note
            </button>
          </form>
        </div>
      )}
      {err && <ErrorNote code="MENTOR" msg={err} retryable onRetry={() => setErr(null)} />}
      <p className="muted">Teacher dashboard shows aggregates only — never per-child surveillance.</p>
    </div>
  );
}
