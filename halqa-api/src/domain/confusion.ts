// Confusion pre-screen — PURE, zero Nest imports.
//
// The router's C pulse returns confusion_0_1, but that costs a model call and
// needs a provider. This T0 screen runs first and catches the cheap, highly
// reliable signals, so a confused learner gets flagged even in RED/BLACK
// degradation. It is what `eval/confusion_set.jsonl` measures.
//
// Deliberately high precision over recall: a false "you're confused" nudge is
// more annoying than a missed one, and the C pulse still runs afterwards.

export interface ConfusionSignals {
  /** Asked for the same thing to be said again. */
  rephraseLoop: boolean;
  /** Failed, retried the same way, failed again. */
  wrongRetry: boolean;
  /** Gave up entirely. */
  frustration: boolean;
  /** Went from writing paragraphs to one or two words. */
  shortAfterLong: boolean;
  /** Said nothing useful at all. */
  silence: boolean;
}

const REPHRASE = [
  /\b(peux[- ]tu|tu peux)\s+(re)?dire\b/i,
  /\bredire\b/i,
  /\brep[eé]ter?\b/i,
  /\breformul/i,
  /\bje comprends pas\b/i,
  /\bje ne comprends pas\b/i,
  /(عاود|تعاود)\s*(فسر|اشرح)/,
  /ما\s*فهمت(ش)?/,
  /\b(explain|say)\s+(that\s+)?again\b/i,
  /\bwhat do you mean\b/i,
  /\bI (still )?don'?t (get|understand)\b/i,
];

const WRONG_RETRY = [
  /\b(j'ai (refait|recommencé)|same mistake|toujours faux|wrong (half|again)|twice)\b/i,
  /\b(essa(y|i)é|tried)\b.*\b(marche pas|doesn'?t work|got it wrong)\b/i,
  /(عاودت|جربت).*(غلط|ما\s*خدمش|ما\s*يمشيش)/,
];

const FRUSTRATION = [
  /\b(j'?abandonne|trop compliqu[eé]|ça sert à rien|this makes no sense|too hard|i give up|don'?t get .* at all)\b/i,
  /(نتخلى|صعيب برشا|ما\s*فيهاش\s*فايدة|ما\s*عندوش\s*معنى)/,
];

const SILENCE = [/^\s*(\.{2,}|…+|\?{2,}|-+|ok|d'accord|daccord|fine|oui|yes|ah|euh|hmm)\s*[.!?]*\s*$/i];

function isArabicScript(text: string): boolean {
  return /[؀-ۿ]/.test(text);
}

/**
 * @param text      the learner's current message
 * @param priorText their previous message, if any (for the short-after-long signal)
 */
export function screenConfusion(text: string, priorText?: string): ConfusionSignals {
  const t = text.trim();
  const words = t.split(/\s+/).filter(Boolean).length;

  const silence = SILENCE.some((re) => re.test(t)) || words === 0;
  const rephraseLoop = !silence && REPHRASE.some((re) => re.test(t));
  const wrongRetry = WRONG_RETRY.some((re) => re.test(t));
  const frustration = FRUSTRATION.some((re) => re.test(t));

  // A learner who wrote a full sentence and now answers "ok" is stuck.
  const prior = priorText?.trim() ?? '';
  const priorWords = prior.split(/\s+/).filter(Boolean).length;
  const shortAfterLong = !silence && priorWords >= 8 && words <= 2;

  return { rephraseLoop, wrongRetry, frustration, shortAfterLong, silence };
}

export function isConfused(s: ConfusionSignals): boolean {
  return s.rephraseLoop || s.wrongRetry || s.frustration || s.shortAfterLong || s.silence;
}

/** Primary signal name, matching the `signal` field in the eval fixture. */
export function primarySignal(s: ConfusionSignals): string {
  if (s.frustration) return 'frustration';
  if (s.wrongRetry) return 'wrong_retry';
  if (s.rephraseLoop) return 'rephrase_loop';
  if (s.shortAfterLong) return 'short_after_long';
  if (s.silence) return 'silence';
  return 'none';
}

/** 0..1 confidence, consumed by the router when the C pulse is unavailable. */
export function confusionScore(s: ConfusionSignals): number {
  if (s.frustration) return 0.9;
  if (s.wrongRetry) return 0.8;
  if (s.rephraseLoop) return 0.7;
  if (s.shortAfterLong) return 0.6;
  if (s.silence) return 0.5;
  return 0;
}

export { isArabicScript };
