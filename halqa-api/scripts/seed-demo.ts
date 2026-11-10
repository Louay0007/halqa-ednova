/* eslint-disable no-console */
/**
 * Deterministic demo reset — plan §12 task 6.4.
 *
 *   npm run seed:demo          # reset + write the demo scenario
 *   npm run seed:demo -- kb    # validate one asset instead
 *   npm run seed:all           # validate everything, then reset the demo
 *
 * Wipes the demo-owned collections first, then writes the recorded story:
 * 5 learners (incl. one quiet, one dominant), a mentor, a teacher, circle
 * "C-3" mid-session, an anonymous Darija question with a seeded
 * misconception, and the event timeline. Same output every run.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SeedService } from '../src/seed/seed.service';
import type { AssetKey, AssetReport } from '../src/seed/seed.types';

const VALID: AssetKey[] = ['kb', 'dna', 'hints', 'quiz', 'offline', 'eval', 'demo'];

function print(rows: AssetReport[]): void {
  const name = (r: AssetReport) => r.asset.padEnd(8);
  for (const r of rows) {
    const mark = r.rejected === 0 ? 'ok  ' : 'FAIL';
    console.log(`${mark} ${name(r)} ${String(r.written).padStart(3)} rows  ${String(r.ms).padStart(4)}ms`);
    for (const p of r.problems) console.log(`        ${p}`);
  }
}

async function main(): Promise<void> {
  const arg = process.argv[2] as AssetKey | undefined;
  if (arg && !VALID.includes(arg)) {
    console.error(`unknown asset "${arg}" — one of: ${VALID.join(', ')}`);
    process.exit(2);
  }

  if (!process.env.MONGODB_URI) {
    const { loadEnvFile } = await import('node:process');
    try {
      loadEnvFile('.env');
    } catch {
      console.error('No MONGODB_URI and no .env — start `npm run dev:mongo` first.');
      process.exit(2);
    }
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const seed = app.get(SeedService);
    const rows = arg ? [await seed.runOne(arg)] : await seed.runAll();
    print(rows);
    const bad = rows.filter((r) => r.rejected > 0);
    if (bad.length > 0) process.exit(1);
    console.log(`\n[seed] done — ${rows.length} asset(s), ${rows.reduce((n, r) => n + r.written, 0)} rows`);
  } finally {
    await app.close();
  }
}

void main().catch((e: unknown) => {
  console.error(`[seed] ${(e as Error).message}`);
  process.exit(1);
});
