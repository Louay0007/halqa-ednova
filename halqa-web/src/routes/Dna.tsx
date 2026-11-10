import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiFailure, api } from '../lib/api';
import { useSession } from '../lib/session';
import { ErrorNote } from '../components/ui';

export function Dna() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { lang, learnerId } = useSession();
  const [items, setItems] = useState<Array<{ id: string; prompt: string; options: string[] }>>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [nickname] = useState(() => sessionStorage.getItem('halqa.nick') ?? 'Learner');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [passport, setPassport] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    api
      .dnaItems()
      .then((r) => setItems(r.data.items))
      .catch(() => setErr('Could not load the diagnostic.'));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api.dna({
        nickname: sessionStorage.getItem('halqa.nick') ?? `L-${Date.now().toString(36)}`,
        context: 'study',
        answers: answers as Record<string, string>,
      });
      setPassport(r.passport as unknown as Record<string, unknown>);
      setTimeout(() => nav(params.get('next') ?? '/circles/join'), 900);
    } catch (e) {
      const f = e as ApiFailure;
      setErr(f.body?.user_msg?.[lang] ?? 'Diagnostic failed — retry.');
    } finally {
      setBusy(false);
    }
  };

  const ready = ['L1', 'S1', 'G1', 'C1'].every((k) => answers[k]);
  void learnerId;
  void nickname;

  return (
    <div className="page duo">
      <form onSubmit={submit} className="stack">
        <h1>Diagnose — 4 taps, 3 minutes</h1>
        {items.map((it) => (
          <fieldset key={it.id} className="card">
            <legend>
              <strong translate="no">{it.id}</strong> · {it.prompt}
            </legend>
            <div className="opt-row">
              {it.options.map((o) => (
                <button key={o} type="button" aria-pressed={answers[it.id] === o} className={`opt${answers[it.id] === o ? ' opt-on' : ''}`} onClick={() => setAnswers((a) => ({ ...a, [it.id]: o }))}>
                  {o}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
        {err && <ErrorNote code="DNA_FAILED" msg={err} retryable onRetry={() => setErr(null)} />}
        <button type="submit" className="btn" disabled={busy || !ready}>
          {passport ? 'Passport ready ✓' : busy ? 'Saving…' : 'See my passport →'}
        </button>
      </form>
      <aside className="card passport-live" aria-live="polite" aria-label="Passport preview">
        <h2>Learner Passport</h2>
        {passport ? (
          <PassportView p={passport} />
        ) : (
          <p className="muted">Tap the four steps — your passport fills in live.</p>
        )}
      </aside>
    </div>
  );
}

export function PassportView({ p }: { p: Record<string, unknown> }) {
  const w = (p.styleWeights ?? {}) as Record<string, number>;
  const top = Object.entries(w).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'visual';
  return (
    <dl className="passport">
      <div>
        <dt>Level</dt>
        <dd translate="no">{String(p.level ?? '—')}</dd>
      </div>
      <div>
        <dt>Style</dt>
        <dd translate="no">{top}-first</dd>
      </div>
      <div>
        <dt>Language</dt>
        <dd translate="no">{String(p.lang ?? '—')}</dd>
      </div>
      <div>
        <dt>Hints</dt>
        <dd>{Number(p.hintEagerness ?? 0.5) > 0.7 ? 'eager' : Number(p.hintEagerness ?? 0.5) > 0.4 ? 'normal' : 'light'}</dd>
      </div>
      <div>
        <dt>Invite me</dt>
        <dd>{p.inviteMe ? '✓' : '—'}</dd>
      </div>
    </dl>
  );
}
