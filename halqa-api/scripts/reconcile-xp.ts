/**
 * Verify — and optionally repair — that each learner's stored XP matches the sum
 * of their append-only ledger.
 *
 *   npm run reconcile:xp           # report only, exits 1 on any mismatch
 *   npm run reconcile:xp -- --fix  # rewrite the read model from the ledger
 *
 * The ledger is the source of truth (§4.1). This exists because a read model that
 * silently drifts is worse than no read model: it looks authoritative while being
 * wrong, and nobody notices until a learner complains about a lost badge.
 */
import mongoose from 'mongoose';
import { loadEnvFile } from 'node:process';

async function main(): Promise<void> {
  const fix = process.argv.includes('--fix');
  if (!process.env.MONGODB_URI) {
    try {
      loadEnvFile('.env');
    } catch {
      // No .env: rely on real env vars.
    }
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[reconcile] MONGODB_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  const db = mongoose.connection.db;
  if (!db) throw new Error('no database handle');

  const progress = db.collection('learner_progress');
  const ledger = db.collection('xp_ledger');

  const sums = await ledger
    .aggregate<{ _id: string; total: number }>([
      { $group: { _id: '$learnerId', total: { $sum: '$xp' } } },
    ])
    .toArray();
  const byLearner = new Map(sums.map((s) => [s._id, s.total]));

  const rows = await progress.find({}).toArray();
  let mismatches = 0;
  let repaired = 0;

  for (const row of rows) {
    const stored = Number(row.xp ?? 0);
    const expected = byLearner.get(String(row._id)) ?? 0;
    if (stored !== expected) {
      mismatches += 1;
      console.warn(`[reconcile] ${String(row._id)}: stored=${stored} ledger=${expected}`);
      if (fix) {
        // `row._id` is typed as ObjectId but these collections are keyed by the
        // string learner id, so cast the filter rather than the value.
        await progress.updateOne({ _id: String(row._id) } as never, { $set: { xp: expected, updatedAt: new Date() } });
        repaired += 1;
      }
    }
  }

  // A ledger total with no progress row is also drift: the grant landed but the
  // read model was never written.
  for (const [learnerId, total] of byLearner) {
    if (!rows.some((r) => String(r._id) === learnerId)) {
      mismatches += 1;
      console.warn(`[reconcile] ${learnerId}: missing progress row (ledger=${total})`);
      if (fix) {
        await progress.updateOne(
          { _id: learnerId } as never,
          { $set: { xp: total, updatedAt: new Date() } },
          { upsert: true },
        );
        repaired += 1;
      }
    }
  }

  console.log(
    `[reconcile] ${rows.length} learners, ${mismatches} mismatches` +
      (fix ? `, ${repaired} repaired` : ' (report only; pass --fix to repair)'),
  );
  await mongoose.disconnect();
  if (mismatches > 0 && !fix) process.exit(1);
}

void main().catch((e: unknown) => {
  console.error(`[reconcile] failed: ${(e as Error).message}`);
  process.exit(1);
});
