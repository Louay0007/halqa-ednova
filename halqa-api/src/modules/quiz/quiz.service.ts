import { Err } from '../../common/http-errors';
import { Injectable, Logger } from '@nestjs/common';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { EventBus } from '../../telemetry/event-bus';

/**
 * QuizService — Co-op Boss Battle (F-BOSS). Items drawn from the KB bank
 * (probes with answers), adaptive level from the passport. Zero model calls
 * on the happy path, so it works offline; generation fills gaps only.
 */
@Injectable()
export class QuizService {
  private readonly logger = new Logger(QuizService.name);
  private battles = new Map<string, { items: Array<{ qid: string; answer: string }>; answers: Record<string, boolean> }>();
  private seq = 0;

  constructor(
    private readonly knowledge: KnowledgeService,
    private readonly bus: EventBus,
  ) {}

  battle(circleId: string, sessionId: string, level?: string): { bid: string; items: unknown[] } {
    const probes = this.knowledge
      .query()
      .filter((c) => c.kind === 'probe' && (!level || c.level === level || c.level === 'intro'))
      .slice(0, 3);
    const items = probes.map((p) => ({ qid: p.chunk_id, stem: p.text, choices: this.choicesFor(p), level: p.level, lang: p.lang }));
    this.seq += 1;
    const bid = `B-${Date.now().toString(36)}${this.seq}`;
    this.battles.set(bid, {
      items: probes.map((p) => ({ qid: p.chunk_id, answer: (p as { answer?: string }).answer ?? '' })),
      answers: {},
    });
    void this.bus.emit({ sessionId, circleId, actor: 'NOVA', type: 'boss_battle_start', payload: { bid, n: items.length } });
    return { bid, items };
  }

  answer(bid: string, sessionId: string, circleId: string, learnerId: string, qid: string, choice: string): { correct: boolean; explain: string; xp: number } {
    const battle = this.battles.get(bid);
    if (!battle) throw Err.missing(`BATTLE_NOT_FOUND:${bid}`);
    const item = battle.items.find((i) => i.qid === qid);
    if (!item) throw Err.bad(`BATTLE_BAD_QID:${qid}`);
    const correct = choice === item.answer || choice.toLowerCase() === item.answer.toLowerCase();
    battle.answers[`${learnerId}:${qid}`] = correct;
    void this.bus.emit({ sessionId, circleId, actor: learnerId, type: 'boss_battle_answer', payload: { bid, qid, correct } });
    void this.bus.emit({ sessionId, circleId, actor: learnerId, type: 'quiz_answer', payload: { qid, correct } });
    const chunk = this.knowledge.query().find((c) => c.chunk_id === qid);
    return { correct, explain: correct ? 'Correct — the cited chunk confirms it.' : `Not quite — re-check ${qid} (${chunk?.title ?? 'lesson'}).`, xp: correct ? 20 : 5 };
  }

  private choicesFor(p: { chunk_id: string; text: string }): string[] {
    const m = p.text.match(/\((a)\)[^)]*(b)\)[^)]*(c)\)/);
    if (m) return ['a', 'b', 'c'];
    return ['a', 'b', 'c', 'd'];
  }
}
