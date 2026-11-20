import { CapsuleService } from '../../src/modules/capsule/capsule.service';

/**
 * The capsule's L-polish returns a JSON array, and `maxTokens` regularly cuts
 * that array off mid-element. Both the complete and the truncated shape have
 * shipped markup to learners before: `[`, `"…"`, and `1. Polish:**` all reached
 * the debrief screen as bullet text.
 *
 * The service is constructed with no dependencies because these are pure
 * string functions reached through a cast — the alternative is a database and a
 * provider stub to exercise a regex.
 */
const service = new CapsuleService(
  null as never,
  null as never,
  null as never,
  null as never,
  null as never,
  null as never,
  null as never,
  null as never,
  null as never,
);
const split = (text: string, n = 3, lang = 'en', fallback: string[] = []): string[] =>
  (service as unknown as { splitLines(t: string, n: number, l: string, f?: string[]): string[] }).splitLines(
    text,
    n,
    lang,
    fallback,
  );

describe('capsule splitLines', () => {
  it('reads a complete JSON array as three bullets', () => {
    const raw = '["First point","Second point","Third point"]';
    expect(split(raw)).toEqual(['First point', 'Second point', 'Third point']);
  });

  it('keeps the finished elements of a truncated array and drops the cut one', () => {
    // This is the shape the provider actually returned: maxTokens stopped the
    // stream inside the third string, so there is no closing quote and no `]`.
    // The cut element is mid-word ("كل مر"), so it is dropped and the list is
    // padded rather than showing a learner a sentence that stops abruptly.
    const raw = '["علاش: عاود binary search كيحتاج ليستة مرتبة","مثال: 7 في [1,3,5,7,9]","التعقيد O(log n): كل مر';
    expect(split(raw, 3, 'darija')).toEqual([
      'علاش: عاود binary search كيحتاج ليستة مرتبة',
      'مثال: 7 في [1,3,5,7,9]',
      'عاود قرا المقطع وفسّرو لصاحبك.',
    ]);
  });

  it('pads in the capsule language, not in English', () => {
    // The pad used to be hardcoded English, so a French capsule whose polish
    // returned a short array ended with an English sentence as its last bullet.
    expect(split('["seulement une"]', 2, 'fr')[1]).toBe(
      'Relis le passage cité et réexplique-le à un pair.',
    );
    expect(split('["واحدة"]', 2, 'ar')[1]).toBe('أعد قراءة المقطع المُستشهد به واشرحه لزميل.');
  });

  it('un-escapes quotes the model escaped', () => {
    expect(split('["say \\"hi\\"","b","c"]')[0]).toBe('say "hi"');
  });

  it('strips markdown a line-shaped return carries', () => {
    const raw = '1. **Polish:** first\n- second\n• third';
    expect(split(raw)).toEqual(['first', 'second', 'third']);
  });

  it('strips stacked markers', () => {
    // The provider wrote `*1. الشرط:` — bullet asterisk in front of a number.
    // A single strip pass left the `*` visible in the learner's bullet.
    expect(split('["*1. الشرط: liste مرتبة","*2. مثال","*3. التعقيد"]')[0]).toBe(
      'الشرط: liste مرتبة',
    );
  });

  it('pads to the requested count rather than returning a short list', () => {
    const out = split('["only one"]');
    expect(out).toHaveLength(3);
    expect(out[0]).toBe('only one');
    expect(out[1]).toBe('Review the cited chunk and re-explain it to a peer.');
  });

  it('never returns punctuation as a bullet', () => {
    for (const out of [split('["a","b","c"]'), split('["a","b","c'), split('plain\nlines\nhere')]) {
      for (const b of out) expect(b).not.toMatch(/^[\["\],]+$/);
    }
  });
});

describe('capsule clampBullets', () => {
  const clamp = (lines: string[], lang = 'en'): string[] =>
    (service as unknown as { clampBullets(l: string[], g: string): string[] }).clampBullets(
      lines,
      lang,
    );

  it('cuts on a word boundary and does not leave a dangling separator', () => {
    // Darija is capped at 12 words. The provider's third bullet was cut right
    // after an em dash, so the debrief read "كل خطوة كنقسمو النص —…".
    // Word 12 is the dash itself, so the naive cut ended the bullet on it.
    const long =
      'التعقيد O(log n): كل خطوة ننصّفو الليستة وكنبدلو الوسط ديالها بالعنصر — n كتولي n/2 ومن بعد كنكملو';
    expect(clamp([long], 'darija')[0]).toBe(
      'التعقيد O(log n): كل خطوة ننصّفو الليستة وكنبدلو الوسط ديالها بالعنصر…',
    );
  });

  it('leaves a bullet under the cap untouched', () => {
    expect(clamp(['short one'], 'darija')[0]).toBe('short one');
  });
});

describe('capsule polish fragments', () => {
  it('drops a stray quoted fragment and backfills from the draft', () => {
    // Live capture: the model answered in prose, and the scanner pulled `ed:`
    // out of its own wording. It shipped as the first bullet, displacing a
    // draft bullet the learner needed.
    const text = 'Here is the polished version. "ed:" ok then:\n[ "الشرط: الليستة خاصة تكون مرتبة", "التعقيد: O(log n)" ]';
    const draft = ['سؤال أول عن الشرط', 'سؤال ثاني عن التعقيد', 'سؤال ثالث'];
    const out = split(text, 3, 'darija', draft);
    expect(out).not.toContain('ed:');
    expect(out[0]).toBe('الشرط: الليستة خاصة تكون مرتبة');
    expect(out[2]).toBe('سؤال ثالث');
  });

  it('never returns punctuation or a bare label as a bullet', () => {
    for (const junk of ['ed:', 'Polish:', '—', '1.', '  ']) {
      expect(split(`["${junk}"]`, 1, 'en')).not.toContain(junk);
    }
  });

  it('uses the language pad only when the draft has nothing left', () => {
    expect(split('[]', 1, 'fr', [])[0]).toContain('Relis');
  });
});
