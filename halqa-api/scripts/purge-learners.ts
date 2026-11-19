/**
 * Erase the personal fields of learners whose deletion grace period has elapsed.
 *
 *   npm run purge:learners            # report what is due, change nothing
 *   npm run purge:learners -- --apply # actually purge
 *
 * Runs as a scheduled job (nightly is plenty — the deadline it enforces is thirty
 * days, so an hour of drift is meaningless). Kept as a script rather than an
 * in-process timer because a timer on every replica would race: all N would try to
 * purge the same rows, and the last writer would win on a non-idempotent update.
 *
 * `--apply` is required on purpose. A purge is irreversible, and a command that
 * erases data the first time it is typed by reflex is a command that erases data
 * by reflex.
 */
import mongoose from 'mongoose';
import { loadEnvFile } from 'node:process';
import { DataSubjectService } from '../src/modules/auth/data-subject.service';
import { TokenEpochService } from '../src/security/token-epoch.service';

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  if (!process.env.MONGODB_URI) {
    try {
      loadEnvFile('.env');
    } catch {
      // No .env: rely on real env vars.
    }
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[purge] MONGODB_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  const db = mongoose.connection.db;
  if (!db) throw new Error('no database handle');

  const now = new Date();
  const due = await db
    .collection('learners')
    .find({ purgeAfter: { $lte: now } })
    .project({ _id: 1, nickname: 1, purgeAfter: 1 })
    .toArray();

  if (due.length === 0) {
    console.log('[purge] nothing due');
    await mongoose.disconnect();
    return;
  }

  for (const row of due) {
    console.log(`[purge] due: ${String(row._id)} (${String(row.nickname)}) since ${String(row.purgeAfter)}`);
  }

  if (!apply) {
    console.log(`[purge] ${due.length} due — report only, pass --apply to erase`);
    await mongoose.disconnect();
    return;
  }

  // Reuse the service so the purge semantics live in one place rather than being
  // reimplemented here and drifting from what the API means by "purged".
  const model = (_name: string): mongoose.Model<unknown> =>
    mongoose.connection.model(_name) as mongoose.Model<unknown>;
  const service = new DataSubjectService(
    model('Learner') as never,
    model('Circle') as never,
    model('Session') as never,
    model('Question') as never,
    model('PeerAnswer') as never,
    model('PollVote') as never,
    model('LearnerProgress') as never,
    model('XpEntry') as never,
    model('TelemetryEvent') as never,
    // Purging does not sign anyone out — deletion already did, thirty days
    // earlier — so the epoch service is only here to satisfy the constructor.
    new TokenEpochService(model('Learner') as never),
  );

  const { purged } = await service.purgeDue(now);
  console.log(`[purge] purged ${purged} learner(s)`);
  await mongoose.disconnect();
}

void main().catch((e: unknown) => {
  console.error(`[purge] failed: ${(e as Error).message}`);
  process.exit(1);
});
