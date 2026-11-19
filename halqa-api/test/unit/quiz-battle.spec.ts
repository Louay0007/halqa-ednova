import { QuizService } from '../../src/modules/quiz/quiz.service';
import { KnowledgeService } from '../../src/modules/knowledge/knowledge.service';
import { RetrievalService } from '../../src/ai/retrieval/retrieval.service';

/**
 * §5.1 regression suite.
 *
 * The battle used to render three one-letter buttons because the option text was
 * discarded after the marker match. These tests run against the real seed bank,
 * so they fail if a future seed format change silently turns options back into
 * single characters.
 */

async function makeService(): Promise<QuizService> {
  const retrieval = new RetrievalService();
  await retrieval.ingest();
  const knowledge = new KnowledgeService(retrieval);
  const bus = { emit: () => Promise.resolve(), listBySession: () => Promise.resolve([]) } as never;
  return new QuizService(knowledge, bus);
}

describe('QuizService — readable, playable battle', () => {
  it('every option carries real text, not a single letter', async () => {
    const quiz = await makeService();
    const { items } = quiz.battle('C-1', 'S-1');
    expect(items.length).toBeGreaterThan(0);

    for (const item of items) {
      expect(item.choices.length).toBeGreaterThanOrEqual(2);
      for (const c of item.choices) {
        // Latin probes key on a-d; Arabic and Darija probes key on the Arabic
        // letter the seed stores as its answer (أ/ب/ج), which is correct.
        expect(c.key).toMatch(/^[a-d]$|^[\u0621-\u064A]$/);
        // The whole point of the fix: a learner never sees a bare label. The
        // comparison is against the key, not length, because a legitimate option
        // can be one character ("2", "1/2").
        expect(c.text).not.toBe(c.key);
        expect(c.text.length).toBeGreaterThan(0);
      }
    }
  });

  it('strips the option markers out of the question stem', async () => {
    const quiz = await makeService();
    for (const item of quiz.battle('C-2', 'S-2').items) {
      expect(item.stem).not.toMatch(/\([a-d]\)/);
    }
  });

  it('scores the correct key as correct, end to end', async () => {
    const quiz = await makeService();
    const { bid, items } = quiz.battle('C-3', 'S-3');
    const item = items[0];

    // Discover the right key the same way a learner would: try each option.
    // Exactly one must score correct, and no answer may be scored against text.
    const results = item.choices.map((c) =>
      quiz.answer(bid, 'S-3', 'C-3', 'L-1', item.qid, c.key).correct,
    );
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('rejects display text as an answer, so the UI cannot submit the wrong value', async () => {
    const quiz = await makeService();
    const { bid, items } = quiz.battle('C-4', 'S-4');
    const item = items[0];
    const text = item.choices[0].text;
    // Submitting what is rendered must not be accepted as a key.
    expect(quiz.answer(bid, 'S-4', 'C-4', 'L-1', item.qid, text).correct).toBe(false);
  });

  it('is deterministic per seed but not always option "a"', async () => {
    const quiz = await makeService();
    const a = quiz.battle('C-5', 'S-5', undefined, 'seed-alpha');
    const b = quiz.battle('C-5', 'S-5', undefined, 'seed-alpha');
    expect(a.items[0].choices.map((c) => c.key)).toEqual(b.items[0].choices.map((c) => c.key));

    // Across seeds, the correct answer must not always sit in the first slot —
    // every seeded probe answers "a", so without a shuffle the battle is free.
    const firstKeys: string[] = [];
    for (const seed of ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8']) {
      const battle = quiz.battle('C-6', 'S-6', undefined, seed);
      firstKeys.push(battle.items[0].choices[0].key);
    }
    expect(new Set(firstKeys).size).toBeGreaterThan(1);
  });

  it('expires a battle instead of answering a stale one', async () => {
    const quiz = await makeService();
    const { bid, items } = quiz.battle('C-7', 'S-7');
    // Reach into the TTL rather than waiting 24h.
    const internals = quiz as unknown as { battles: Map<string, { expiresAt: number }> };
    const battle = internals.battles.get(bid);
    expect(battle).toBeDefined();
    battle!.expiresAt = Date.now() - 1;

    expect(() => quiz.answer(bid, 'S-7', 'C-7', 'L-1', items[0].qid, 'a')).toThrow(/BATTLE_NOT_FOUND/);
  });
});
