import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiFailure, api, type ContextMode } from '../lib/api';
import { useSession } from '../lib/session';
import { ErrorNote } from '../components/ui';
import { Reveal } from '../lib/motion';
import { styleLabel, t } from '../lib/i18n';

interface DnaOption {
  /** Submitted to POST /dna — the enum the API validates. */
  value: string;
  /** Shown to the learner (may differ from the value, e.g. S1). */
  label: string;
}

interface DnaItem {
  id: string;
  prompt: string;
  options: DnaOption[];
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
        <dd>{t('style_first', lang, { s: styleLabel(top, lang) })}</dd>
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

  // Dna items are T0/static; the error copy is the only lang-dependent part.
  useEffect(() => {
    api
      .dnaItems()
      .then((r) => setItems(r.data.items))
      .catch(() => setErr(t('dna_load', lang)));
  }, [lang]);

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
    <div className="page duo dna">
      {/* The live passport comes first in source order: `.passport-live` is
          `position: sticky` only on wide screens, and in a single column it was
          stacking *after* the four fieldsets — so the "it sees me" moment never
          appeared until the learner had already finished tapping. */}
      <aside className="card passport-live" aria-live="polite" aria-label={t('passport_live', lang)}>
        <h2>{t('passport_live', lang)}</h2>
        <LivePassport p={passport ?? livePassport(answers) ?? ({} as PassportLike)} />
        <p className="hint tnum">
          {t('dna_progress', lang, { n: doneCount })}
        </p>
      </aside>
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
                <label key={o.value} className={`opt${answers[it.id] === o.value ? ' opt-on' : ''}`}>
                  <input
                    type="radio"
                    name={it.id}
                    value={o.value}
                    checked={answers[it.id] === o.value}
                    onChange={() => setAnswers((a) => ({ ...a, [it.id]: o.value }))}
                    className="opt-radio"
                  />
                  <span translate="no">{o.label}</span>
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
    </div>
  );
}

