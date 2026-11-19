import { Err } from '../../common/http-errors';
import { Injectable, Logger } from '@nestjs/common';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { EventBus } from '../../telemetry/event-bus';

/** One answer option: the letter we score on, and the text a learner reads. */
export interface QuizChoice {
  key: string;
  text: string;
}

interface QuizItem {
  qid: string;
  answer: string;
  choices: QuizChoice[];
}

/**
 * QuizService — Co-op Boss Battle (F-BOSS). Items drawn from the KB bank
 * (probes with answers), adaptive level from the passport. Zero model calls on
 * the happy path, so it works offline; generation fills gaps only.
 *
 * Two correctness fixes in the production pass (§5.1):
 *
 * 1. Options used to be the literal strings `'a' | 'b' | 'c'`, because the regex
 *    matched the markers and then discarded the text between them. `Debrief`
 *    rendered three one-letter buttons, so a learner was asked to choose between
 *    "a", "b" and "c" with nothing to distinguish them. The option text was in
 *    `probe.text` all along; it just was not captured.
 * 2. Scoring still compares the **key** (`choice === item.answer`). Returning
 *    display text without keeping that comparison would have marked every answer
 *    wrong, so the key travels with the text and is what gets submitted.
 */
@Injectable()
export class QuizService {
  private readonly logger = new Logger(QuizService.name);
  private battles = new Map<string, { items: QuizItem[]; answers: Record<string, boolean>; expiresAt: number }>();
  private seq = 0;

  /** Battles are ephemeral by design (a debrief toy) but must still expire, or
   *  the map grows for the life of the process. */
  private static readonly TTL_MS = 24 * 60 * 60 * 1000;

  constructor(
    private readonly knowledge: KnowledgeService,
    private readonly bus: EventBus,
  ) {}

  battle(
    circleId: string,
    sessionId: string,
    level?: string,
    seed?: string,
  ): { bid: string; items: Array<{ qid: string; stem: string; choices: QuizChoice[]; level: string; lang: string }> } {
    const probes = this.knowledge
      .query()
      .filter((c) => c.kind === 'probe' && (!level || c.level === level || c.level === 'intro'))
      .slice(0, 3);

    const items = probes.map((p) => ({
      qid: p.chunk_id,
      stem: this.stemFor(p.text),
      // Deterministic shuffle keyed on the seed: the stored answer still points
      // at the right option, but "always the first button" stops being a winning
      // strategy — every seeded probe currently answers "a".
      choices: shuffle(this.choicesFor(p.text), seed ?? circleId),
      level: p.level,
      lang: p.lang,
    }));

    this.seq += 1;
    const bid = `B-${Date.now().toString(36)}${this.seq}`;

    // Drop expired battles before inserting, so the map stays bounded without a timer.
    const now = Date.now();
    for (const [id, b] of this.battles) if (b.expiresAt <= now) this.battles.delete(id);

    this.battles.set(bid, {
      items: probes.map((p, i) => ({
        qid: p.chunk_id,
        answer: (p as { answer?: string }).answer ?? '',
        choices: items[i].choices,
      })),
      answers: {},
      expiresAt: now + QuizService.TTL_MS,
    });

    void this.bus.emit({
      sessionId,
      circleId,
      actor: 'NOVA',
      type: 'boss_battle_start',
      payload: { bid, n: items.length },
    });
    return { bid, items };
  }

  answer(
    bid: string,
    sessionId: string,
    circleId: string,
    learnerId: string,
    qid: string,
    choice: string,
  ): { correct: boolean; explain: string; xp: number } {
    const battle = this.battles.get(bid);
    if (!battle || battle.expiresAt <= Date.now()) {
      this.battles.delete(bid);
      throw Err.missing(`BATTLE_NOT_FOUND:${bid}`);
    }
    const item = battle.items.find((i) => i.qid === qid);
    if (!item) throw Err.bad(`BATTLE_BAD_QID:${qid}`);
    // `choice` is the option key ("a".."d"), which is exactly what `answer`
    // stores. Display text is never submitted.
    const correct = choice.trim().toLowerCase() === item.answer.trim().toLowerCase();
    battle.answers[`${learnerId}:${qid}`] = correct;
    void this.bus.emit({ sessionId, circleId, actor: learnerId, type: 'boss_battle_answer', payload: { bid, qid, correct } });
    void this.bus.emit({ sessionId, circleId, actor: learnerId, type: 'quiz_answer', payload: { qid, correct } });
    const chunk = this.knowledge.query().find((c) => c.chunk_id === qid);
    return {
      correct,
      explain: correct
        ? 'Correct — the cited chunk confirms it.'
        : `Not quite — re-check ${qid} (${chunk?.title ?? 'lesson'}).`,
      xp: correct ? 20 : 5,
    };
  }

  /**
   * Extract `{ key, text }` options from a probe.
   *
   * The previous regex matched the markers but never captured the text between
   * them, so the options were unusable. This captures each option body and falls
   * back to letter keys if a probe is not formatted as a labelled question.
   */
  private choicesFor(text: string): QuizChoice[] {
    // Arabic and Darija probes label options with Arabic letters (أ‌/ب‌/ج) and
    // store the answer as that letter, so a Latin-only pattern silently produced
    // an empty option list for half the bank.
    const labelled: QuizChoice[] = [];
    for (const m of text.matchAll(MARKER_RE)) {
      const body = text.slice(m.index! + m[0].length);
      const next = body.search(MARKER_ONLY);
      const raw = (next === -1 ? body : body.slice(0, next)).trim();
      // Group 1 is the Latin/space-prefixed form, group 2 the sentence-initial one.
      const key = m[1] ?? m[2];
      if (raw && key) labelled.push({ key, text: raw.replace(/[.,;:]$/, '').trim() });
    }
    if (labelled.length >= 2) return labelled;
    // Probes without markers still need a playable battle; the stem carries the
    // question, so offer the letters rather than an empty option list.
    return ['a', 'b', 'c', 'd'].map((k) => ({ key: k, text: k.toUpperCase() }));
  }

  /** The question itself, with the option markers stripped out. */
  private stemFor(text: string): string {
    const cut = text.search(MARKER_ONLY);
    return (cut > 0 ? text.slice(0, cut) : text).trim().replace(/[:\s]+$/, '') || text;
  }
}

/** An option marker at the start of a token: `(a)` or `(أ)` etc. */
const MARKER_RE = /(?<=\s|\)|\u061F)\s*\(([a-d]|[\u0621-\u064A])\)|^\(([a-d]|[\u0621-\u064A])\)/g;
/** Same, unanchored, for finding where the next option begins and the stem ends. */
const MARKER_ONLY = /\([a-d]|[\u0621-\u064A]\)/;

/** Deterministic, seed-stable shuffle so a battle reproduces but is not positional. */
function shuffle<T>(items: T[], seed: string): T[] {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
