/**
 * Shipped data assets and how a loader reports on them.
 *
 * Every loader is idempotent: running `seed:*` twice leaves the same rows
 * (upserts on a stable _id). The demo reset is the one exception — it drops
 * the collections it owns first, because "reset" is the point.
 */

export type AssetKey = 'kb' | 'dna' | 'hints' | 'quiz' | 'offline' | 'eval' | 'demo';

export interface AssetReport {
  asset: AssetKey;
  /** Source paths read, relative to the api root. */
  sources: string[];
  /** Rows written (upserted) to Mongo. */
  written: number;
  /** Rows the loader refused — a non-zero count fails the command. */
  rejected: number;
  /** Human-readable reasons, one per rejected row. */
  problems: string[];
  ms: number;
}

export interface LoaderResult {
  report: AssetReport;
  /** Extra facts for the console summary (chunk counts per topic, etc.). */
  detail?: Record<string, unknown>;
}

export function emptyReport(asset: AssetKey): AssetReport {
  return { asset, sources: [], written: 0, rejected: 0, problems: [], ms: 0 };
}

export function finish(asset: AssetKey, startedAt: number, r: Omit<AssetReport, 'asset' | 'ms'>): AssetReport {
  return { asset, ...r, ms: Date.now() - startedAt };
}

export function assertClean(reports: AssetReport[]): void {
  const bad = reports.filter((r) => r.rejected > 0);
  if (bad.length === 0) return;
  const lines = bad.flatMap((r) => r.problems.map((p) => `  [${r.asset}] ${p}`));
  throw new Error(`seed rejected ${bad.reduce((n, r) => n + r.rejected, 0)} row(s):\n${lines.join('\n')}`);
}
