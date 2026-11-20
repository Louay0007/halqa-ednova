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

/** An id with at least two hyphens — `bs-en-01`, `frac-en-ex1`. "base-2" is not one. */
const isBareId = (part: string): boolean =>
  /\d/.test(part) && /^[a-z][a-z0-9]*(?:-[a-z0-9]+){2,3}$/i.test(part);

/**
 * The third form the model writes: the id joined to the sentence by an arrow —
 * `… إلى هنا → bs-en-01`, `bs-fr-01 → bs-en-03 →`. The arrow is matched with the
 * id so neither is left behind.
 */
function stripArrows(text: string): string {
  return text
    .replace(/(?:^|\s)(?:→|⟶|->)\s*([a-z][a-z0-9]*(?:-[a-z0-9]+){1,3})(?=\s|[.,;:!?؟،]|$)/gi,
      (whole, id: string) => (isChunkId(id) ? ' ' : whole))
    .replace(/(?:^|\s)([a-z][a-z0-9]*(?:-[a-z0-9]+){1,3})\s*(?:→|⟶|->)/gi,
      (whole, id: string) => (isChunkId(id) ? ' ' : whole));
}

/** A bare id the model dropped into the sentence with no bracket and no arrow. */
const BARE_ID = /(?:^|\s)([a-z][a-z0-9]*(?:-[a-z0-9]+){2,3})(?=\s|[.,;:!?؟،]|$)/gi;

export function plainText(text: string | undefined | null): string {
  if (!text) return '';
  return stripArrows(
    stripCitations(
      text
        .replace(/\*\*|__|`/g, '')
        .replace(/^\s{0,3}#{1,6}\s+/gm, '')
        // The rule has to be tested before the bullet marker, or `---` is read
        // as one bullet dash and two characters of prose survive. Its own line
        // ending goes with it, so a separator does not become a blank line.
        .replace(/^[ \t]{0,3}(?:[-–—_*][ \t]*){3,}\n?/gm, '')
        .replace(/^\s*[-*•]\s+/gm, '')
        .replace(/^\s*\d+[.)]\s+/gm, ''),
    ),
  )
    .replace(BARE_ID, (whole, id: string) => (isBareId(id) ? ' ' : whole))
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
