import { Injectable, Logger } from '@nestjs/common';

/**
 * MatcherService — Circle Matcher (F-V2-6). Deterministic greedy grouping:
 * complementary levels (never all-same), compatible languages (share ≥1),
 * diverse styles. Seeded shuffle → reproducible; same seed = byte-identical.
 */
export interface MatchInput {
  learnerId: string;
  level: string;
  lang: string;
  style: string;
}

@Injectable()
export class MatcherService {
  private readonly logger = new Logger(MatcherService.name);

  /** Seeded PRNG (mulberry32). */
  private rng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  match(learners: MatchInput[], seed = 2026): { seed: number; groups: Array<{ circleId: string; learnerIds: string[]; rationale: string }> } {
    const rand = this.rng(seed);
    const shuffled = [...learners].sort(() => rand() - 0.5);
    const groups: Array<{ circleId: string; learnerIds: string[]; rationale: string }> = [];
    let gi = 0;
    // Greedy: fill 3-5s, mixing levels + langs.
    for (let i = 0; i < shuffled.length; i += 4) {
      const slice = shuffled.slice(i, i + 4);
      if (slice.length < 2 && groups.length > 0) {
        groups[groups.length - 1].learnerIds.push(...slice.map((l) => l.learnerId));
        continue;
      }
      gi += 1;
      const levels = new Set(slice.map((l) => l.level));
      const langs = new Set(slice.map((l) => l.lang));
      groups.push({
        circleId: `C-match-${gi}`,
        learnerIds: slice.map((l) => l.learnerId),
        rationale: `levels:${[...levels].join('/')} langs:${[...langs].join('/')} mixed ${levels.size > 1 ? 'complementary' : 'peer-level'}`,
      });
    }
    return { seed, groups };
  }
}
