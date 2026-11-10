import { Injectable, Logger } from '@nestjs/common';
import { RetrievalService, ChunkInput } from '../../ai/retrieval/retrieval.service';

/**
 * KnowledgeModule — Concept Packs (F-PACK). Validates seeds (§2.1 schema),
 * syncs them into the retrieval index, and serves chunk CRUD for the app
 * (admin-only in prod per plan §9; public read in dev/test).
 */
@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(private readonly retrieval: RetrievalService) {}

  async sync(): Promise<{ files: number; docs: number; ms: number }> {
    return this.retrieval.ingest();
  }

  query(topic?: string, lang?: string): ChunkInput[] {
    return this.retrieval.listChunks(topic, lang);
  }

  stats(): { docs: number; topics: string[] } {
    const all = this.retrieval.listChunks();
    return { docs: all.length, topics: [...new Set(all.map((c) => c.topic))] };
  }
}
