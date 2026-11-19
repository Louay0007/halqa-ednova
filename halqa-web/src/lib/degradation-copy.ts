import type { DegradationMode, Lang } from './api';

/** Degradation banner copy (spec §3.2) — pure lookup, no React.
 *
 *  Lives outside lib/session.tsx (a component module) to keep Fast Refresh
 *  working; session.tsx re-exports it so `from '../lib/session'` still works. */

const COPY: Record<Exclude<DegradationMode, 'green'>, Record<Lang, string>> = {
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

export function degradationCopy(mode: DegradationMode, lang: Lang): string | null {
  if (mode === 'green') return null;
  return COPY[mode][lang];
}
