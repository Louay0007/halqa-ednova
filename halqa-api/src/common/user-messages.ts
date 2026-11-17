import type { Language } from './types/api-error';

/**
 * Learner-facing text per domain error code, in all four supported languages.
 * The global filter fills `user_msg` from here so an Arabic or French UI never
 * falls back to English. Codes carry an optional `:detail` suffix — match the prefix.
 *
 * ponytail: hand-written table, one entry per code. Add a row when a new code appears;
 * the fallback is the generic sentence, which is worse than English detail but never lies.
 */
type Msg = Record<Language, string>;

const GENERIC: Msg = {
  en: 'Something went wrong. Please try again.',
  fr: 'Une erreur est survenue. Réessayez.',
  ar: 'حدث خطأ ما. حاول مجدداً.',
  darija: 'وقع مشكل. عاود حاول.',
};

const RETRY_LATER: Msg = {
  en: 'Too many requests right now — try again in a moment.',
  fr: 'Trop de requêtes — réessayez dans un instant.',
  ar: 'طلبات كثيرة الآن — حاول بعد قليل.',
  darija: 'برشة طلبات توّا — عاود بعد شوية.',
};

export const USER_MESSAGES: Record<string, Msg> = {
  ANSWER_EMPTY: { en: 'Write your answer first.', fr: "Écrivez d'abord votre réponse.", ar: 'اكتب جوابك أولاً.', darija: 'اكتب جوابك الأول.' },
  ACCOUNT_EXISTS: { en: 'This record already has an account.', fr: 'Cet enregistrement a déjà un compte.', ar: 'هذا السجل له حساب بالفعل.', darija: 'السجل هذا عندو حساب من قبل.' },
  ACCOUNT_REQUIRED: { en: 'Create an account first.', fr: "Créez d'abord un compte.", ar: 'أنشئ حساباً أولاً.', darija: 'اعمل حساب الأول.' },
  AUTH_INVALID: { en: 'Your session expired — enter again.', fr: 'Session expirée — reconnectez-vous.', ar: 'انتهت الجلسة — أدخل من جديد.', darija: 'الجلسة وفات — ادخل عاود.' },
  AUTH_REQUIRED: { en: 'Enter a nickname to start.', fr: 'Entrez un surnom pour commencer.', ar: 'أدخل كنية للبدء.', darija: 'دخّل كنية باش تبدا.' },
  AVATAR_UNKNOWN: { en: 'Pick one of the offered avatars.', fr: 'Choisissez un des avatars proposés.', ar: 'اختر واحداً من الصور المتاحة.', darija: 'اختار واحد من الأفاتارات.' },
  CAPSULE_NOT_FOUND: { en: 'No capsule yet for this session.', fr: 'Pas encore de capsule pour cette session.', ar: 'لا توجد خلاصة لهذه الجلسة بعد.', darija: 'ما زال ما فماش خلاصة للجلسة.' },
  CIRCLE_CLOSED: { en: 'This circle is wrapped up.', fr: 'Ce cercle est terminé.', ar: 'هذه الحلقة مغلقة.', darija: 'الحلقة هذي تسكرت.' },
  CIRCLE_CODE_UNKNOWN: { en: 'No circle with that code.', fr: 'Aucun cercle avec ce code.', ar: 'لا توجد حلقة بهذا الرمز.', darija: 'ما فماش حلقة بالكود هذا.' },
  CIRCLE_NOT_FOUND: { en: 'This circle no longer exists.', fr: "Ce cercle n'existe plus.", ar: 'هذه الحلقة لم تعد موجودة.', darija: 'الحلقة هذي ما عادش موجودة.' },
  FORBIDDEN_ROLE: { en: "Your account can't do that.", fr: 'Votre compte ne peut pas faire ça.', ar: 'حسابك لا يستطيع فعل ذلك.', darija: 'الحساب متاعك ما ينجمش يعمل هذا.' },
  HINT_ASKER_ONLY: { en: 'Only the asker can take hints.', fr: 'Seul celui qui pose la question peut demander des indices.', ar: 'صاحب السؤال وحده يمكنه طلب التلميحات.', darija: 'غير اللي سقسا ينجم يطلب الـhints.' },
  HINT_L4_LOCKED: { en: 'Answer unlocks after hints 1–3.', fr: 'La réponse vient après les indices 1–3.', ar: 'الإجابة بعد التلميحات 1–3.', darija: 'الإجابة تجي بعد الـhints 1–3.' },
  HINT_ORDER: { en: 'Take the hints in order.', fr: 'Prenez les indices dans l’ordre.', ar: 'خذ التلميحات بالترتيب.', darija: 'خذ الـhints بالترتيب.' },
  HINT_WINDOW_OPEN: { en: 'Peers still have the floor — hints wait.', fr: 'Les pairs ont encore la parole — les indices attendent.', ar: 'الأقران يتحدثون الآن — التلميحات تنتظر.', darija: 'الـpeers مازالو يحكيو — الـhints يستنّاو.' },
  HANDLE_INVALID: { en: 'Use 3–20 letters, numbers, - or _.', fr: 'Utilisez 3 à 20 lettres, chiffres, - ou _.', ar: 'استعمل 3 إلى 20 حرفاً أو رقماً أو - أو _.', darija: 'استعمل 3 حتى 20 حرف ولا رقم ولا - ولا _.' },
  LOGIN_FAILED: { en: 'Wrong name or passphrase.', fr: 'Nom ou phrase secrète incorrects.', ar: 'الاسم أو العبارة السرية غير صحيحة.', darija: 'الاسم ولا العبارة السرية غالطين.' },
  NICKNAME_EMPTY: { en: 'Pick a nickname.', fr: 'Choisissez un surnom.', ar: 'اختر كنية.', darija: 'اختار كنية.' },
  NICKNAME_TAKEN: { en: 'That nickname is taken in this circle.', fr: 'Ce surnom est déjà pris dans ce cercle.', ar: 'هذه الكنية مستعملة في هذه الحلقة.', darija: 'الكنية هذي ماخوذة في الحلقة.' },
  PASSPHRASE_LENGTH: { en: 'Use at least 8 characters for the passphrase.', fr: 'La phrase secrète doit faire 8 caractères minimum.', ar: 'العبارة السرية تحتاج 8 أحرف على الأقل.', darija: 'العبارة السرية تحتاج 8 حروف على الأقل.' },
  NOT_A_MEMBER: { en: "You're not in this circle.", fr: 'Vous n’êtes pas dans ce cercle.', ar: 'أنت لست في هذه الحلقة.', darija: 'انتَ ماكش في الحلقة هذي.' },
  NOTE_EMPTY: { en: 'Write a note first.', fr: "Écrivez d'abord une note.", ar: 'اكتب ملاحظة أولاً.', darija: 'اكتب ملاحظة الأول.' },
  PEER_NOT_ASKER: { en: "The asker can't answer their own question.", fr: 'Celui qui pose la question ne peut pas y répondre.', ar: 'صاحب السؤال لا يجيب عليه.', darija: 'اللي سقسا ما ينجمش يجاوب.' },
  POLL_BAD_CHOICE: { en: 'That choice is not on the ballot.', fr: 'Ce choix ne figure pas au vote.', ar: 'هذا الخيار ليس في التصويت.', darija: 'الاختيار هذا ما فماش في التصويت.' },
  POLL_CLOSED: { en: 'This vote is already closed.', fr: 'Ce vote est déjà clos.', ar: 'هذا التصويت أغلق.', darija: 'التصويت هذا تسكر.' },
  POLL_NEEDS_SESSION_OR_QUESTION: { en: 'A poll needs a session or a question.', fr: 'Un vote a besoin d’une session ou d’une question.', ar: 'التصويت يحتاج جلسة أو سؤالاً.', darija: 'التصويت يحتاج session ولا سؤال.' },
  POLL_NOT_FOUND: { en: 'This vote no longer exists.', fr: "Ce vote n'existe plus.", ar: 'هذا التصويت لم يعد موجوداً.', darija: 'التصويت هذا ما عادش موجود.' },
  QUESTION_CLOSED: { en: 'This question is already resolved.', fr: 'Cette question est déjà résolue.', ar: 'هذا السؤال مُجاب عليه.', darija: 'السؤال هذا تجاوب.' },
  QUESTION_EMPTY: { en: 'Write your question first.', fr: "Écrivez d'abord votre question.", ar: 'اكتب سؤالك أولاً.', darija: 'اكتب سؤالك الأول.' },
  QUESTION_NOT_FOUND: { en: 'This question no longer exists.', fr: "Cette question n'existe plus.", ar: 'هذا السؤال لم يعد موجوداً.', darija: 'السؤال هذا ما عادش موجود.' },
  SELF_ONLY: { en: 'You can only change your own progress.', fr: 'Vous ne pouvez modifier que votre propre progression.', ar: 'يمكنك تغيير تقدمك فقط.', darija: 'تنجم تبدّل غير التقدّم متاعك.' },
  SESSION_NOT_FOUND: { en: 'This session no longer exists.', fr: "Cette session n'existe plus.", ar: 'هذه الجلسة لم تعد موجودة.', darija: 'الجلسة هذي ما عادش موجودة.' },
  SKIP_ASKER_ONLY: { en: 'Only the asker can reveal the answer.', fr: 'Seul celui qui pose la question peut révéler la réponse.', ar: 'صاحب السؤال وحده يكشف الإجابة.', darija: 'غير اللي سقسا ينجم يبيّن الإجابة.' },
  WHISPER_NEEDS_CHAIN: { en: 'The relay needs at least two links.', fr: 'Le relais a besoin de deux maillons au moins.', ar: 'السلسلة تحتاج رابطين على الأقل.', darija: 'السلسلة تحتاج زوز روابط على الأقل.' },
  LEARNER_NOT_FOUND: { en: 'This learner no longer exists.', fr: "Cet apprenant n'existe plus.", ar: 'هذا المتعلم لم يعد موجوداً.', darija: 'المتعلم هذا ما عادش موجود.' },
};

/** Strip the `:detail` suffix some codes carry. */
export function userMessageFor(code: string, status: number, englishDetail: string): Msg {
  const key = code.split(':')[0] ?? code;
  if (USER_MESSAGES[key]) return USER_MESSAGES[key];
  if (status === 429) return RETRY_LATER;
  if (status >= 500) return GENERIC;
  // Unknown 4xx: the English detail is more useful than a vague sentence, and the
  // other languages reuse it rather than inventing a translation.
  return { en: englishDetail, fr: englishDetail, ar: englishDetail, darija: englishDetail };
}
