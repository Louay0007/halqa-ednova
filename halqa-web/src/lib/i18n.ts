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
  asker_only: {
    en: 'Only the asker can take hints',
    fr: 'Seul celui qui pose la question peut demander des indices',
    ar: 'صاحب السؤال وحده يمكنه طلب التلميحات',
    darija: 'غير اللي سقسا ينجم يطلب الـhints',
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

  // §6.7 — shell systems (spec §3)
  setup_hint: {
    en: 'Backend not reachable',
    fr: 'Backend injoignable',
    ar: 'الـBackend غير متاح',
    darija: 'الـBackend ما يخدمش',
  },
  setup_hint_body: {
    en: 'Start the API, then reload this page.',
    fr: 'Lance l’API, puis recharge cette page.',
    ar: 'شغّل الـAPI ثم أعد تحميل الصفحة.',
    darija: 'شغّل الـAPI وبعد reload الصفحة.',
  },
  setup_hint_cmd: { en: 'cd halqa-api && npm run start:dev', fr: 'cd halqa-api && npm run start:dev', ar: 'cd halqa-api && npm run start:dev', darija: 'cd halqa-api && npm run start:dev' },
  open_passport: { en: 'Open passport', fr: 'Ouvrir le passeport', ar: 'افتح الجواز', darija: 'حلّ الجواز' },
  close: { en: 'Close', fr: 'Fermer', ar: 'أغلق', darija: 'سدّ' },
  copy_code: { en: 'Copy circle code', fr: 'Copier le code', ar: 'انسخ رمز الحلقة', darija: 'انسخ الرمز' },
  copied: { en: 'Copied ✓', fr: 'Copié ✓', ar: 'تنسخ ✓', darija: 'تنسخ ✓' },
  qr_circle: { en: 'Scan to join this circle', fr: 'Scanne pour rejoindre', ar: 'امسح للانضمام', darija: 'امسح باش تدخل' },
  nav_circle: { en: 'Circle', fr: 'Cercle', ar: 'الحلقة', darija: 'الحلقة' },
  nav_passport: { en: 'Passport', fr: 'Passeport', ar: 'الجواز', darija: 'الجواز' },
  nav_board: { en: 'Board', fr: 'Tableau', ar: 'اللوحة', darija: 'اللوحة' },
  nav_lab: { en: 'Lab', fr: 'Labo', ar: 'المختبر', darija: 'اللابو' },
  stale: { en: 'stale', fr: 'périmé', ar: 'قديم', darija: 'قديم' },
  quota_out: {
    en: 'Quota out — simplified answers only',
    fr: 'Quota épuisé — réponses simplifiées',
    ar: 'انتهت الحصة — إجابات مبسطة فقط',
    darija: 'وفات الكوطا — إجابات مختصرة برك',
  },
  pw_current: { en: 'Current passphrase', fr: 'Phrase actuelle', ar: 'العبارة الحالية', darija: 'العبارة الحالية' },
  pw_new: { en: 'New passphrase', fr: 'Nouvelle phrase', ar: 'عبارة جديدة', darija: 'عبارة جديدة' },
  pw_update: { en: 'Update passphrase', fr: 'Mettre à jour', ar: 'حدّث العبارة', darija: 'بدّل العبارة' },
  pw_hint: {
    en: '8 characters minimum — signs other devices out.',
    fr: '8 caractères min. — déconnecte les autres appareils.',
    ar: '8 أحرف على الأقل — يخرج الأجهزة الأخرى.',
    darija: '8 حروف على الأقل — يخرّج الأجهزة الأخرى.',
  },
  guest_upgrade: {
    en: 'Guest record — claim an account on /enter to keep your passport.',
    fr: 'Compte invité — réclamez un compte sur /enter pour garder votre passeport.',
    ar: 'سجل ضيف — أنشئ حساباً من /enter لتحفظ جوازك.',
    darija: 'سيزيون ضيف — أصنع حساب من /enter باش تحفظ الجواز.',
  },
  sign_out: { en: 'Sign out', fr: 'Déconnexion', ar: 'خروج', darija: 'خرج' },
  skip_content: { en: 'Skip to content', fr: 'Aller au contenu', ar: 'تجاوز إلى المحتوى', darija: 'تجاوز للمحتوى' },
};

export function t(key: string, lang: Lang): string {
  return STRINGS[key]?.[lang] ?? STRINGS[key]?.en ?? key;
}

export const RTL: Lang[] = ['ar'];export type { Lang };
