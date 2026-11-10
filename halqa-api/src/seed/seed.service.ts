import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { KnowledgeService } from '../modules/knowledge/knowledge.service';
import { DemoReset } from './demo-reset';
import { AssetKey, AssetReport, LoaderResult, assertClean, finish } from './seed.types';

const ROOT = process.cwd();

interface Asset {
  key: AssetKey;
  /** Where the data lives. Files are the source of truth for these assets —
   *  the app reads them at boot, so seeding validates rather than copies. */
  paths: string[];
  what: string;
}

const ASSETS: Asset[] = [
  { key: 'kb', paths: ['kb/seeds', 'kb/SOURCES.md'], what: '39 concept-pack chunks + SOURCES manifest' },
  { key: 'hints', paths: ['src/domain/hint-templates.ts'], what: 'L1–L3 ladder templates for 2 topics × 4 languages' },
  { key: 'offline', paths: ['offline/pack.json'], what: '30 offline snippets for RED/BLACK degradation' },
  { key: 'dna', paths: ['src/modules/learning/learning.service.ts'], what: '4 DNA micro-items (L1/S1/G1/C1)' },
  { key: 'quiz', paths: ['kb/seeds'], what: 'boss-battle probes (drawn from KB, 7 with answers)' },
  { key: 'eval', paths: ['eval'], what: 'confusion 20 · parity 24 · seeded 3 · whisper truth · users' },
];

/**
 * SeedService — validates every shipped data asset and reports what it holds.
 *
 * KB, hints, offline pack, DNA items, quiz probes and eval fixtures are
 * **file-backed at runtime**: RetrievalService, HintService, OfflineService
 * and QuizService read them straight from disk, so writing a second copy to
 * Mongo would create two sources of truth that can silently disagree. Those
 * loaders therefore verify structure and count rows rather than duplicating.
 *
 * `demo` is the exception — it writes learners, circles, sessions, questions
 * and events, because the demo state is data the app cannot derive.
 */
@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly knowledge: KnowledgeService,
    private readonly demo: DemoReset,
  ) {}

  manifest(): Asset[] {
    return ASSETS;
  }

  /** Validate one file-backed asset. Throws if a required path is missing. */
  private check(key: AssetKey, paths: string[]): LoaderResult {
    const startedAt = Date.now();
    const problems: string[] = [];
    let written = 0;

    for (const rel of paths) {
      const abs = path.resolve(ROOT, rel);
      if (!fs.existsSync(abs)) {
        problems.push(`missing ${rel}`);
        continue;
      }
      if (fs.statSync(abs).isDirectory()) {
        written += fs.readdirSync(abs).filter((f) => f.endsWith('.json') || f.endsWith('.jsonl')).length;
      } else {
        written += 1;
      }
    }

    const report = finish(key, startedAt, {
      sources: paths,
      written,
      rejected: problems.length,
      problems,
    });
    return { report };
  }

  private async checkKb(): Promise<LoaderResult> {
    const startedAt = Date.now();
    const problems: string[] = [];
    // Re-ingest through the real service so an invalid seed fails here, not at
    // the first question of the demo.
    await this.knowledge.sync();
    const stats = this.knowledge.stats();
    if (stats.docs < 39) problems.push(`kb has ${stats.docs} chunks, expected >= 39`);
    for (const t of ['binary_search', 'fractions']) {
      if (!stats.topics.includes(t)) problems.push(`kb is missing topic ${t}`);
    }
    const report = finish('kb', startedAt, {
      sources: ['kb/seeds/*.json', 'kb/SOURCES.md'],
      written: stats.docs,
      rejected: problems.length,
      problems,
    });
    return { report, detail: { topics: stats.topics } };
  }

  async runOne(key: AssetKey): Promise<AssetReport> {
    let result: LoaderResult;
    if (key === 'kb') {
      result = await this.checkKb();
    } else if (key === 'demo') {
      result = { report: await this.demo.run() };
    } else {
      const asset = ASSETS.find((a) => a.key === key);
      if (!asset) throw new Error(`unknown asset: ${key}`);
      result = this.check(key, asset.paths);
    }
    assertClean([result.report]);
    return result.report;
  }

  async runAll(): Promise<AssetReport[]> {
    const reports: AssetReport[] = [];
    for (const asset of [...ASSETS, { key: 'demo' } as Asset]) {
      reports.push(await this.runOne(asset.key));
    }
    assertClean(reports);
    return reports;
  }
}
