import type mongoose from 'mongoose';

/**
 * Ordered data migrations (§10.2). See `scripts/migrate.ts` for the runner.
 *
 * Rules that keep a deploy reversible:
 *  - **Additive for one release.** Do not drop or rename a field the previous
 *    image still reads. Ship the removal a release later, as its own migration.
 *  - **Idempotent and retryable.** A crash between `up()` and its recording
 *    leaves the migration pending, so the next run replays it. Use `$set` and
 *    upserts; never a bare `$inc`.
 *  - **No app imports.** These run during a deploy, against the live database,
 *    before traffic — they must not depend on services being wired.
 */
export interface Migration {
  id: string;
  description: string;
  up: (db: mongoose.mongo.Db) => Promise<void>;
}

export const MIGRATIONS: Migration[] = [
  {
    id: '001-xp-ledger-backfill',
    description: 'seed xp_ledger from learner_progress for learners granted XP before the ledger existed',
    /**
     * The ledger is the auditable truth and the read model is derived from it, so
     * a learner whose points predate the ledger has a read model with no history
     * behind it — `reconcile:xp` would report drift on every one of them. This
     * writes a single opening entry per affected learner.
     *
     * Filtered on "has progress but no ledger rows" so re-running is a no-op.
     */
    async up(db) {
      const progressed = await db
        .collection('learner_progress')
        .find({ xp: { $gt: 0 } })
        .project({ learnerId: 1, xp: 1 })
        .toArray();
      for (const row of progressed) {
        const learnerId = String(row.learnerId);
        const existing = await db.collection('xp_ledger').countDocuments({ learnerId });
        if (existing > 0) continue;
        // Fixed dedupeKey: if this migration is replayed after a partial write, the
        // second attempt is rejected by the unique index instead of double-crediting.
        await db.collection('xp_ledger').insertOne({
          learnerId,
          xp: Number(row.xp),
          signal: 'migration_backfill',
          dedupeKey: `migration:001:${learnerId}`,
          ts: new Date(),
        } as never);
      }
    },
  },
  {
    id: '002-learner-deletion-fields',
    description: 'initialise deletedAt/purgeAfter to null so the erasure queries can use one filter shape',
    /**
     * The seeder shipped before §3.10, so early learners have no `deletedAt` at
     * all. Queries use `{ purgeAfter: { $lte: now } }`, which never matches a
     * missing field, so this is correctness rather than tidiness: without it a
     * learner created before the feature can never be purged by the due-query.
     */
    async up(db) {
      await db
        .collection('learners')
        .updateMany({ purgeAfter: { $exists: false } }, { $set: { purgeAfter: null, deletedAt: null } });
    },
  },
];
