/**
 * Create the least-privilege MongoDB users the API and the backup job run as.
 *
 * Run once per environment, as an admin user, *before* the API is pointed at the
 * database:
 *
 *   mongosh "$ADMIN_URI" --file scripts/mongo-roles.js
 *
 * Why two users instead of one: the API and `mongodump` do not need the same
 * privileges, and a single account with both means an application bug or a
 * leaked connection string can also drop collections or rewrite history. The API
 * gets read/write on the data it owns and nothing else; the backup user is
 * read-only, so a compromised backup credential cannot corrupt production.
 *
 * `--eval` rather than a `.js` file is avoided on purpose: these statements are
 * idempotent and belong in version control next to the schema, not in a runbook
 * nobody reads.
 */
/* eslint-disable no-undef */

const DB = process.env.HALQA_DB || 'halqa';

function ensureRole(name, roles, db = DB) {
  const existing = db.getRole(name);
  if (existing) {
    db.updateRole(name, { roles, privileges: [] });
    return `updated role ${name}`;
  }
  db.createRole({ role: name, roles: [], privileges: roles });
  return `created role ${name}`;
}

function ensureUser(name, pwd, roles) {
  if (!pwd) return `skipped ${name}: no password supplied`;
  const existing = db.getUser(name);
  if (existing) {
    db.updateUser(name, { pwd, roles });
    return `updated user ${name}`;
  }
  db.createUser({ user: name, pwd, roles });
  return `created user ${name}`;
}

// The API reads and writes its own collections. Notably it is *not* given
// `dbAdmin` (index builds are a deploy-time job run by the migration user), nor
// `clusterAdmin`, so it cannot reconfigure the replica set it depends on.
ensureRole('halqaApiRole', [
  { resource: { db: DB, collection: '' }, actions: ['find', 'insert', 'update', 'remove', 'createIndex'] },
  // TTL indexes prune telemetry/llm_calls/cache; dropping them is a migration,
  // not something a running request may do.
  { resource: { db: DB, collection: 'system.js' }, actions: ['find'] },
]);
ensureUser('halqa_api', process.env.HALQA_API_PWD, [{ role: 'halqaApiRole', db: DB }]);

// Read-only, so a backup credential leak cannot alter production.
ensureRole('halqaBackupRole', [
  { resource: { db: DB, collection: '' }, actions: ['find'] },
  { resource: { db: 'admin', collection: '' }, actions: ['listCollections', 'listIndexes'] },
]);
ensureUser('halqa_backup', process.env.HALQA_BACKUP_PWD, [{ role: 'halqaBackupRole', db: DB }]);

// Index builds and schema migrations: separate again, because `autoIndex` is off
// in production (§7.3) and `migrate-indexes.ts` is the only thing allowed to
// create them. Held by a human/CI, never mounted into the API container.
ensureUser('halqa_migrate', process.env.HALQA_MIGRATE_PWD, [
  { role: 'dbAdmin', db: DB },
  { role: 'readWrite', db: DB },
]);

print('mongo roles applied');
