/**
 * Ephemeral dev Mongo on a fixed port, for machines without Docker.
 *
 *   npm run dev:mongo        # leave running in one terminal
 *   npm run start:dev        # .env MONGODB_URI points at :27017
 *
 * Data lives in the OS temp dir and is wiped on exit — this is a dev
 * convenience, not a database. Use docker compose (mongo service) for
 * anything you want to keep.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

const PORT = Number(process.env.DEV_MONGO_PORT ?? 27017);

async function main(): Promise<void> {
  const mongod = await MongoMemoryServer.create({
    instance: { port: PORT, dbName: 'halqa' },
  });
  console.log(`[dev-mongo] listening on ${mongod.getUri('halqa')}`);

  const stop = async (signal: string): Promise<void> => {
    console.log(`[dev-mongo] ${signal} — shutting down`);
    await mongod.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => void stop('SIGINT'));
  process.on('SIGTERM', () => void stop('SIGTERM'));
}

void main().catch((e: unknown) => {
  console.error(`[dev-mongo] failed: ${(e as Error).message}`);
  process.exit(1);
});
