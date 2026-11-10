import type { Lang } from './api';

export const STRINGS: Record<string, Record<Lang, string>> = {
  peers_first: {
    en: 'Peers answer first — Nova prepares quietly',
    fr: 'Les pairs d’abord — Nova prépare en silence',
    ar: 'الزملاء أولاً — Nova تحضّر بصمت',
    darija: 'الزملاء هوما لولين — Nova تحضّر في صمت',
  },
  skip: { en: 'Skip the wait', fr: 'Passer l’attente', ar: 'تخطَّ الانتظار', darija: 'فوّت الاستنا' },
  simplified: {
    en: 'Simplified answer (quota)',
    fr: 'Réponse simplifiée (quota)',
    ar: 'إجابة مبسطة (الحصة)',
    darija: 'إجابة مختصرة (الكوطا)',
  },
  offline_mode: {
    en: 'Offline — circle tools still work',
    fr: 'Hors ligne — les outils du cercle marchent',
    ar: 'دون اتصال — أدوات الحلقة تعمل',
    darija: 'بلا connexion — أدوات الحلقة تخدم',
  },
  ai_sleeps: {
    en: 'Even when the AI sleeps, the circle keeps learning',
    fr: 'Même quand l’IA dort, le cercle continue d’apprendre',
    ar: 'حتى عندما تنام الـAI، تواصل الحلقة التعلم',
    darija: 'حتى كي الـAI ترقد، الحلقة تكمّل تتعلّم',
  },
  l4_locked: {
    en: 'Answer unlocks after hints 1–3',
    fr: 'La réponse vient après les indices 1–3',
    ar: 'الإجابة بعد التلميحات 1–3',
    darija: 'الإجابة تجي بعد الـhints 1–3',
  },
  ask: { en: 'Ask', fr: 'Demander', ar: 'اسأل', darija: 'اسأل' },
  i_can_help: { en: 'I can help', fr: 'Je peux aider', ar: 'أقدر نعاون', darija: 'ننجم نعاون' },
  me_too: { en: 'Me too', fr: 'Moi aussi', ar: 'أنا أيضاً', darija: 'أنا زادة' },
  nova_thinking: { en: 'Nova is thinking…', fr: 'Nova réfléchit…', ar: 'Nova يفكّر…', darija: 'Nova يخمم…' },
  verified: { en: 'verified by Nova', fr: 'vérifié par Nova', ar: 'تحققت منه Nova', darija: 'تأكدت منو Nova' },
  retry: { en: 'Retry', fr: 'Réessayer', ar: 'حاول مجدداً', darija: 'عاود حاول' },
};

export function t(key: string, lang: Lang): string {
  return STRINGS[key]?.[lang] ?? STRINGS[key]?.en ?? key;
}

export const RTL: Lang[] = ['ar', 'darija'];
export type { Lang };
