/**
 * Model output is markdown-flavoured, but the product renders it as plain text
 * in a `<p>`. Without this the learner reads the markup: `**bs-en-01**` and
 * `1. Polish:**` were both shipping verbatim.
 *
 * Only inline emphasis is removed. A double asterisk is always markup; single
 * `*` is left alone because it is also a wildcard in the CS topics this product
 * teaches (`O(log n)` comparisons, graph notation).
 */

/** The shape every KB chunk id has: `bs-en-01`, `frac-en-ex1`, `bs-darija-03`. */
const CHUNK_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+){1,3}$/i;

/**
 * A slug with at least one digit. The digit is what separates an id from an
 * ordinary hyphenated word — `deep-dive` would otherwise match the shape above.
 */
const isChunkId = (part: string): boolean => /\d/.test(part) && CHUNK_ID.test(part);

/** Anything a citation is wrapped in: `[bs-en-01]`, `(bs-en-01, bs-fr-01)`. */
const BRACKETED = /[([]\s*[^()[\]]{0,160}?\s*[\])]/g;

/**
 * The model is told to ground its answer in particular chunks and writes the ids
 * into the sentence — `… [bs-en-01]`. The ids are already rendered as chips under
 * the paragraph, and a Latin id inside RTL prose breaks the run, so the copy that
 * reads back into the sentence is dropped and the chips stay the citation.
 */
function stripCitations(text: string): string {
  return text.replace(BRACKETED, (whole) => {
    const parts = whole
      .slice(1, -1)
      .split(/[,;،]/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0 || !parts.every(isChunkId)) return whole;
    // `[bs-en-01].` leaves the full stop behind; keep it, drop only the group.
    return '';
  });
}

/** A bare id the model wrote without any bracket: `… أشار إلى bs-en-01 ثم`. */
const BARE_ID = /(?:^|\s)([a-z][a-z0-9]*(?:-[a-z0-9]+){1,3})(?=\s|[.,;:!?؟،]|$)/gi;

export function plainText(text: string | undefined | null): string {
  if (!text) return '';
  return stripCitations(
    text
      .replace(/\*\*|__|`/g, '')
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/^\s*(?:[-*•]\s*|[-–—_]{3,}\s*$)/gm, '')
      .replace(/^\s*\d+[.)]\s+/gm, ''),
  )
    .replace(BARE_ID, (whole, id: string) => (isChunkId(id) ? ' ' : whole))
    // Removing an id mid-sentence leaves a doubled space, and leaves a space in
    // front of the punctuation that followed it.
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([.,;:!?؟،])/g, '$1')
    .trim();
}

/**
 * The same sanitizer, one string per paragraph.
 *
 * A deep dive comes back as blank-line-separated paragraphs with a bold lead.
 * Rendered into a single `<p>`, the newlines collapse and the whole answer
 * becomes one run-on block — the learner cannot find where the conclusion
 * starts. Empty groups are dropped rather than rendered as blank lines.
 */
export function plainParagraphs(text: string | undefined | null): string[] {
  if (!text) return [];
  return text
    .split(/\n\s*\n/)
    .map((p) => plainText(p))
    .filter((p) => p.length > 0);
}
