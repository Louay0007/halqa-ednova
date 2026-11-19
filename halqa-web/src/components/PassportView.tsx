import { useSession } from '../lib/session';
import { styleLabel, t } from '../lib/i18n';

/** The passport card (spec §3.4 / R2 fixed format):
 *  `Level · Style · Lang · Hints · Invite me`.
 *
 *  Lives in components/ rather than routes/Dna.tsx because the passport sheet
 *  and /me both render it. Exporting it from the route made Dna.tsx a static
 *  dependency of two other chunks, which defeated its lazy route import. */
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
