import { MongoMemoryReplSet } from 'mongodb-memory-server';

/**
 * A single-node replica set for integration tests.
 *
 * Transactions require one (`withTransaction` fails on standalone with
 * "Transaction numbers are only allowed on a replica set member"), and the
 * settling flows are transactional (§4.6). Using standalone here would make the
 * suite pass while the production path was broken — the exact failure this
 * helper exists to prevent.
 *
 * `getUri(dbName)` already appends both the database name and the
 * `?replicaSet=<name>` option, so what it returns is used verbatim. String
 * surgery on top of it produced `...?replicaSet=rs0halqa-test?replicaSet=rs0`,
 * which mongoose rejected with "Server selection timed out".
 */
export async function startReplSet(dbName = 'halqa-test'): Promise<{ uri: string; stop: () => Promise<unknown> }> {
  const repl = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  return {
    uri: repl.getUri(dbName),
    stop: () => repl.stop(),
  };
}
