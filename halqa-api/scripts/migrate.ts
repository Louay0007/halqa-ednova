/**
 * Ordered, versioned data migrations.
 *
 * `migrate-indexes.ts` handles *structure* (indexes follow the schemas and
 * `syncIndexes` is idempotent by construction). This handles *content* — the
 * changes no schema declaration can make: backfilling a new field, moving a
 * value, splitting a collection. Those are not idempotent by nature, so each one
 * runs exactly once and is recorded.
 *
 *   npm run migrate                    # apply pending
 *   npm run migrate -- --dry-run       # list pending, change nothing
 *   npm run migrate -- --list          # show applied and pending
 *
 * Each migration is `{ id, up }` in `src/persistence/migrations/index.ts`, where
 * `id` is a zero-padded sequence (`001-…`). The runner applies them in id order,
 * records `{ _id: id, appliedAt }` in `_migrations`, and stops at the first
 * failure — a later migration may assume an earlier one ran.
 *
 * **Rollback story (§10.3):** migrations are additive for one release. Nothing
 * here drops a field or a collection that the previous image still reads; the
 * destructive step ships as its own migration a release later, once the prior
 * version is retired. That is why there is no `down()`: the rollback is "deploy
 * the previous image", not "run the migration backwards".
 */
import mongoose from 'mongoose';
import { loadEnvFile } from 'node:process';

interface Migration {
  id: string;
  /** What this changes, in one line, for the deploy log. */
  description: string;
  up: (db: mongoose.mongo.Db) => Promise<void>;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const listOnly = process.argv.includes('--list');

  if (!process.env.MONGODB_URI) {
    try {
      loadEnvFile('.env');
    } catch {
      // No .env: rely on real env vars.
    }
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[migrate] MONGODB_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  const db = mongoose.connection.db;
  if (!db) throw new Error('no database handle');

  const { MIGRATIONS } = await import('../src/persistence/migrations/index');
  const all = MIGRATIONS as Migration[];

  const applied = await db
    .collection('_migrations')
    .find({})
    .project({ _id: 1 })
    .toArray();
  const done = new Set(applied.map((r) => String(r._id)));

  const pending = all.filter((m) => !done.has(m.id)).sort((a, b) => a.id.localeCompare(b.id));

  if (listOnly) {
    for (const m of all) {
      console.log(`${done.has(m.id) ? 'applied' : 'pending'}  ${m.id}  ${m.description}`);
    }
    await mongoose.disconnect();
    return;
  }

  if (pending.length === 0) {
    console.log('[migrate] nothing pending');
    await mongoose.disconnect();
    return;
  }

  for (const m of pending) {
    if (dryRun) {
      console.log(`[migrate] would apply ${m.id} — ${m.description}`);
      continue;
    }
    console.log(`[migrate] applying ${m.id} — ${m.description}`);
    await m.up(db);
    // Recorded only after `up` resolves, so a crash mid-migration leaves it
    // pending and the next run retries it. That is why every `up` must be safe
    // to retry (use upserts and `$set`, never bare increments).
    await db.collection('_migrations').insertOne({ _id: m.id, appliedAt: new Date() } as never);
  }

  console.log(`[migrate] ${dryRun ? 'dry run complete' : `applied ${pending.length}`}`);
  await mongoose.disconnect();
}

void main().catch((e: unknown) => {
  console.error(`[migrate] failed: ${(e as Error).message}`);
  process.exit(1);
});
