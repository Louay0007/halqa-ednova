import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface OfflineSnippet {
  id: string;
  topic: string;
  lang: string;
  kind: string;
  text: string;
  chunk_refs: string[];
}

/**
 * OfflineService — serves the 30-snippet offline pack (plan §6.1).
 * Pure file-backed, zero model calls. Used in RED/BLACK degradation:
 * the circle keeps teaching with zero connectivity.
 */
@Injectable()
export class OfflineService {
  private readonly logger = new Logger(OfflineService.name);
  private pack: OfflineSnippet[] | null = null;

  load(): OfflineSnippet[] {
    if (this.pack) return this.pack;
    try {
      const raw = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'offline', 'pack.json'), 'utf8'));
      const snippets = Array.isArray(raw) ? raw : (raw.snippets ?? []);
      this.pack = snippets as OfflineSnippet[];
    } catch (e) {
      this.logger.warn(`offline pack load failed: ${(e as Error).message}`);
      this.pack = [];
    }
    return this.pack ?? [];
  }

  serve(topic?: string, lang?: string): { text: string; cites: string[]; offline: true } {
    const pack = this.load();
    const hit =
      pack.find((s) => (!topic || s.topic === topic) && (!lang || s.lang === lang)) ??
      pack.find((s) => s.topic === 'generic' && (!lang || s.lang === lang)) ??
      pack[0];
    if (!hit) return { text: 'Nova is offline — discuss with your peers using the poll.', cites: [], offline: true };
    return { text: hit.text, cites: hit.chunk_refs ?? [], offline: true };
  }

  stats(): { snippets: number } {
    return { snippets: this.load().length };
  }
}
