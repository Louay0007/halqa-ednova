import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { normaliseArabizi } from '../../domain/arabizi';
import { TfIdfIndex, rewriteQuery } from './tfidf';

export interface ChunkInput {
  chunk_id: string;
  topic: string;
  lang: string;
  level: string;
  kind: string;
  title: string;
  text: string;
  claims: string[];
}

export interface RetrievalHit {
  chunkId: string;
  lang: string;
  kind: string;
  claims: string[];
  score: number;
  cites: string[];
}

/**
 * Retrieval service (plan §3.9 / §7): TF-IDF index built at startup (<1 s),
 * hybrid 0.7·vec + 0.3·keyword + 0.15·langBoost, top-5, claim checklists
 * attached. Arabizi normalised before indexing and querying. Every grounded
 * answer must carry non-empty cites (asserted in tests).
 */
@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);
  private readonly index = new TfIdfIndex();
  private readonly chunks = new Map<string, ChunkInput>();
  private loaded = false;

  async onModuleInit(): Promise<void> {
    await this.ingest();
  }

  /** Test hook: add docs without touching the filesystem (skips known ids). */
  addDocs(docs: ChunkInput[]): void {
    for (const d of docs) {
      if (this.chunks.has(d.chunk_id)) continue;
      this.chunks.set(d.chunk_id, d);
      this.index.addDoc(d.chunk_id, normaliseArabizi(d.text), d.lang, d.level, d.claims ?? [], d.kind);
    }
    this.loaded = true;
  }

  getChunk(id: string): ChunkInput | undefined {
    return this.chunks.get(id);
  }

  listChunks(topic?: string, lang?: string): ChunkInput[] {
    return [...this.chunks.values()].filter(
      (c) => (!topic || c.topic === topic) && (!lang || c.lang === lang),
    );
  }

  /** Ingest kb/seeds/*.json. Tolerates a missing/empty dir (Phase 1). */
  async ingest(dir?: string): Promise<{ files: number; docs: number; ms: number }> {
    const start = Date.now();
    const kbDir = dir ?? path.resolve(process.cwd(), 'kb', 'seeds');
    let files = 0;
    try {
      if (!fs.existsSync(kbDir)) {
        this.logger.warn(`kb dir missing (${kbDir}) — index stays empty until Phase 2 seeds`);
        return { files: 0, docs: this.index.size, ms: Date.now() - start };
      }
      for (const f of fs.readdirSync(kbDir).filter((x) => x.endsWith('.json'))) {
        const raw = JSON.parse(fs.readFileSync(path.join(kbDir, f), 'utf8'));
        const docs: ChunkInput[] = Array.isArray(raw) ? raw : [];
        this.addDocs(docs);
        files += 1;
      }
    } catch (e) {
      this.logger.warn(`kb ingest failed: ${(e as Error).message}`);
    }
    this.loaded = true;
    const ms = Date.now() - start;
    this.logger.log(`kb ingested: ${files} files, ${this.index.size} docs in ${ms}ms`);
    return { files, docs: this.index.size, ms };
  }

  get docCount(): number {
    return this.index.size;
  }

  /** Primary-variant diagnosis for the escalation gate (router §6.3):
   *  top-2 of the RAW query only — expansion variants are for recall,
   *  adjudication uses the primary. */
  diagnose(intent: string, _level: string, sessionLang: string): { count: number; top2: Array<{ score: number; kind?: string }> } {
    const norm = normaliseArabizi(intent);
    const hits = this.index.search(norm, sessionLang, 5);
    return { count: hits.length, top2: hits.slice(0, 2).map((h) => ({ score: h.score, kind: h.kind })) };
  }

  /** Query across the 3 T0 rewrite variants; dedupe by chunk, keep best score. */
  search(intent: string, level: string, sessionLang: string, topK = 5): RetrievalHit[] {    const norm = normaliseArabizi(intent);
    const best = new Map<string, RetrievalHit>();
    for (const variant of rewriteQuery(norm, level)) {
      for (const hit of this.index.search(variant, sessionLang, topK)) {
        const prev = best.get(hit.id);
        if (!prev || hit.score > prev.score) {
          best.set(hit.id, { chunkId: hit.id, lang: hit.lang, kind: hit.kind, claims: hit.claims, score: hit.score, cites: [hit.id] });
        }
      }
    }
    return [...best.values()].sort((a, b) => b.score - a.score || (a.chunkId < b.chunkId ? -1 : 1)).slice(0, topK);
  }
}
