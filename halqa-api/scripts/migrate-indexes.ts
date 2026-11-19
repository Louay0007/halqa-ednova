/**
 * Ensure every collection index exists, out of band from application boot.
 *
 * In production `autoIndex` is false (§7.3): building indexes on boot is O(n)
 * per collection, delays readiness, and races when several replicas start at
 * once. This script is the explicit migration step — run it before serving
 * traffic, and after any schema change that adds an index.
 *
 *   npm run migrate:indexes
 *
 * It is idempotent: `syncIndexes` creates what is missing and drops what the
 * schema no longer declares, which is exactly the migration semantics we want.
 */
import mongoose from 'mongoose';
import { loadEnvFile } from 'node:process';

async function main(): Promise<void> {
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
  // Imported after connect so the schemas register against this connection.
  const { modelsOn } = await import('../src/persistence/model-registry');
  const models = modelsOn(mongoose.connection);

  let created = 0;
  let dropped = 0;
  // `unknown` models here are typed loosely on purpose: syncIndexes is the only
  // operation this script needs, and it exists on every Model.
  for (const [name, model] of Object.entries(models) as Array<[string, import('mongoose').Model<unknown>]>) {
    const before = await model.collection.indexes().catch(() => []);
    await model.syncIndexes();
    const after = await model.collection.indexes();
    const added = after.length - before.length;
    if (added > 0) created += added;
    if (added < 0) dropped += -added;
    console.log(`[migrate] ${name}: ${after.length} indexes (${added >= 0 ? '+' : ''}${added})`);
  }

  console.log(`[migrate] done — created ${created}, dropped ${dropped}`);
  await mongoose.disconnect();
}

void main().catch((e: unknown) => {
  console.error(`[migrate] failed: ${(e as Error).message}`);
  process.exit(1);
});
