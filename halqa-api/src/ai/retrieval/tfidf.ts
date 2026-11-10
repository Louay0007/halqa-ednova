// Minimal deterministic TF-IDF — PURE, zero deps, zero Nest imports.
// Built at startup (<1 s for the KB sizes in this project); queried per turn.

export interface IndexedDoc {
  id: string;
  lang: string;
  level: string;
  kind: string;
  claims: string[];
  terms: Map<string, number>;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^\p{L}\p{N}]+/gu)
    .filter((t) => t.length > 1);
}

export class TfIdfIndex {
  private docs: IndexedDoc[] = [];
  private df = new Map<string, number>();

  get size(): number {
    return this.docs.length;
  }

  addDoc(id: string, text: string, lang: string, level: string, claims: string[] = [], kind = 'lesson'): void {
    const terms = new Map<string, number>();
    for (const t of tokenize(text)) terms.set(t, (terms.get(t) ?? 0) + 1);
    for (const t of terms.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    this.docs.push({ id, lang, level, kind, claims, terms });
  }

  private idf(term: string): number {
    const df = this.df.get(term) ?? 0;
    return Math.log(1 + this.docs.length / (1 + df));
  }

  /** Raw vector score of one doc against query terms. */
  vectorScore(doc: IndexedDoc, queryTerms: string[]): number {
    let s = 0;
    for (const q of queryTerms) {
      const tf = doc.terms.get(q) ?? 0;
      if (tf > 0) s += (1 + Math.log(tf)) * this.idf(q);
    }
    return s;
  }

  /**
   * Hybrid search: 0.7·vector + 0.3·keywordOverlap + 0.15·langBoost.
   * Deterministic: ties broken by chunk id. Returns at most topK.
   */
  search(query: string, sessionLang: string, topK = 5): Array<{ id: string; lang: string; kind: string; claims: string[]; score: number }> {
    const qterms = tokenize(query);
    if (qterms.length === 0 || this.docs.length === 0) return [];
    const qset = new Set(qterms);
    const scored = this.docs.map((doc) => {
      const vec = this.vectorScore(doc, qterms);
      let overlap = 0;
      for (const q of qset) if (doc.terms.has(q)) overlap += 1;
      const keyword = overlap / qset.size;
      const boost = doc.lang === sessionLang ? 0.15 : 0;
      return { id: doc.id, lang: doc.lang, kind: doc.kind, claims: doc.claims, score: 0.7 * vec + 0.3 * keyword + boost };
    });
    scored.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
    return scored.slice(0, topK);
  }
}

/** T0 query rewrite: 3 deterministic variants per turn (blueprint §3.9). */
export function rewriteQuery(intent: string, level: string): string[] {
  const base = intent.trim();
  return [base, `${base} ${level}`, `${base} example`];
}
