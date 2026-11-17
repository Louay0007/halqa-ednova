import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiFailure, api, type ContextMode } from '../lib/api';
import { useSession } from '../lib/session';
import { ErrorNote } from '../components/ui';
import { Reveal } from '../lib/motion';
import { t } from '../lib/i18n';

interface DnaItem {
  id: string;
  prompt: string;
  options: string[];
}

interface PassportLike {
  level?: string;
  styleWeights?: Record<string, number>;
  lang?: string;
  hintEagerness?: number;
  inviteMe?: boolean;
}

/** Live-filling passport (spec R2): while the learner taps, the aside mirrors
 *  the selections so the passport visibly grows — the "it sees me" moment. */
function livePassport(answers: Record<string, string>): PassportLike | null {
  const level = answers['L1'];
  const styleTop = answers['S1'];
  const lang = answers['G1'];
  const hint = answers['C1'];
  if (!level && !styleTop && !lang && !hint) return null;
  const styleWeights: Record<string, number> = {};
  if (styleTop) {
    styleWeights[styleTop] = 1;
    styleWeights['visual'] = styleWeights['visual'] ?? 0;
    styleWeights['social'] = styleWeights['social'] ?? 0;
    styleWeights['kinesthetic'] = styleWeights['kinesthetic'] ?? 0;
    styleWeights['verbal'] = styleWeights['verbal'] ?? 0;
  }
  const hintEagerness = hint === 'eager' || hint === '1' ? 0.9 : hint === 'normal' || hint === '0.5' ? 0.5 : 0.25;
  return {
    level: level ?? '—',
    styleWeights,
    lang: lang ?? '—',
    hintEagerness,
    inviteMe: false,
  };
}

function LivePassport({ p }: { p: PassportLike }) {
  const { lang } = useSession();
  const w = p.styleWeights ?? {};
  const top = Object.entries(w).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'visual';
  const eager = Number(p.hintEagerness ?? 0.5) > 0.7;
  const normal = Number(p.hintEagerness ?? 0.5) > 0.4;
  return (
    <dl className="passport">
      <div>
        <dt>{t('passport_level', lang)}</dt>
        <dd translate="no">{String(p.level ?? '—')}</dd>
      </div>
      <div>
        <dt>{t('passport_style', lang)}</dt>
        <dd translate="no">{top}-first</dd>
      </div>
      <div>
        <dt>{t('passport_lang', lang)}</dt>
        <dd translate="no">{String(p.lang ?? '—')}</dd>
      </div>
      <div>
        <dt>{t('passport_hints', lang)}</dt>
        <dd>{eager ? t('dna_hint_eager', lang) : normal ? t('dna_hint_normal', lang) : t('dna_hint_light', lang)}</dd>
      </div>
      <div>
        <dt>{t('passport_invite', lang)}</dt>
        <dd>{p.inviteMe ? t('dna_invited', lang) : '—'}</dd>
      </div>
    </dl>
  );
}

export function Dna() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { lang, setLearnerId } = useSession();
  const [items, setItems] = useState<DnaItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [passport, setPassport] = useState<PassportLike | null>(null);

  useEffect(() => {
    api
      .dnaItems()
      .then((r) => setItems(r.data.items))
      .catch(() => setErr((t('dna_load', lang) as unknown as string)));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api.dna({
        nickname: sessionStorage.getItem('halqa.nick') ?? undefined,
        context: (params.get('context') as ContextMode | null) ?? 'study',
        answers: answers as Record<string, string>,
      });
      setLearnerId(r.learnerId);
      setPassport(r.passport as unknown as PassportLike);
      setTimeout(() => nav(params.get('next') ?? '/circles/join'), 900);
    } catch (e) {
      const f = e as ApiFailure;
      setErr((f.body?.user_msg?.[lang]) ?? (t('dna_failed', lang) as string));
    } finally {
      setBusy(false);
    }
  };

  const doneCount = ['L1', 'S1', 'G1', 'C1'].filter((k) => answers[k]).length;
  const ready = doneCount === 4;

  return (
    <div className="page duo">
      <form onSubmit={submit} className="stack">
        <Reveal as="header" className="duo-head" index={0}>
          <h1>{t('dna_title', lang)}</h1>
          <p className="muted">{t('dna_sub', lang)}</p>
        </Reveal>
        {items.map((it, i) => (
          <Reveal as="fieldset" key={it.id} className="card dna-step" index={i + 1}>
            <legend>
              <strong translate="no">{it.id}</strong> · {it.prompt}
            </legend>
            <div className="opt-row" role="radiogroup" aria-label={it.prompt}>
              {it.options.map((o) => (
                <label key={o} className={`opt${answers[it.id] === o ? ' opt-on' : ''}`}>
                  <input
                    type="radio"
                    name={it.id}
                    value={o}
                    checked={answers[it.id] === o}
                    onChange={() => setAnswers((a) => ({ ...a, [it.id]: o }))}
                    className="opt-radio"
                  />
                  <span>{o}</span>
                </label>
              ))}
            </div>
          </Reveal>
        ))}
        {err && <ErrorNote code="DNA_FAILED" msg={err} retryable onRetry={() => setErr(null)} />}
        <button type="submit" className="btn" disabled={busy || !ready} style={{ minHeight: 44 }}>
          {passport ? t('dna_ready', lang) : busy ? t('dna_saving', lang) : t('dna_submit', lang)}
        </button>
      </form>
      <aside className="card passport-live" aria-live="polite" aria-label="Passport preview">
        <h2>{t('passport_live', lang)}</h2>
        <LivePassport p={passport ?? livePassport(answers) ?? ({}) as PassportLike} />
        <p className="hint tnum">
          {t('dna_progress', lang, { n: doneCount })} · {doneCount}/4
        </p>
      </aside>
    </div>
  );
}

export function PassportView({ p }: { p: Record<string, unknown> }) {
  const { lang } = useSession();
  const w = (p.styleWeights ?? {}) as Record<string, number>;
  const top = Object.entries(w).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'visual';
  const eager = Number(p.hintEagerness ?? 0.5) > 0.7;
  const normal = Number(p.hintEagerness ?? 0.5) > 0.4;
  return (
    <dl className="passport">
      <div>
        <dt>{t('passport_level', lang)}</dt>
        <dd translate="no">{String(p.level ?? '—')}</dd>
      </div>
      <div>
        <dt>{t('passport_style', lang)}</dt>
        <dd translate="no">{top}-first</dd>
      </div>
      <div>
        <dt>{t('passport_lang', lang)}</dt>
        <dd translate="no">{String(p.lang ?? '—')}</dd>
      </div>
      <div>
        <dt>{t('passport_hints', lang)}</dt>
        <dd>{eager ? t('dna_hint_eager', lang) : normal ? t('dna_hint_normal', lang) : t('dna_hint_light', lang)}</dd>
      </div>
      <div>
        <dt>{t('passport_invite', lang)}</dt>
        <dd>{p.inviteMe ? t('dna_invited', lang) : '—'}</dd>
      </div>
    </dl>
  );
}
