#!/usr/bin/env node
// Secrets scan gate — fails the build if key-looking material is committed.
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SELF = 'scripts/scan-secrets.js';

/** Places where a key-shaped literal is the point of the file, not a leak. */
const FIXTURE_FILES = [
  '.env.example',
  'test/', // scrubber and PII specs assert on deliberately fake keys
  'scripts/scan-secrets.js',
];

function isAllowed(line) {
  return FIXTURE_FILES.some((f) => line.includes(f));
}

const PATTERNS = [
  'sk-[A-Za-z0-9]{16,}',
  'AKIA[0-9A-Z]{16}',
  '-----BEGIN [A-Z ]*PRIVATE KEY-----',
  'PROVIDER_API_KEY\\s*=\\s*\\S+',
];

function gitGrep(pattern) {
  const r = spawnSync(
    'git',
    ['grep', '-n', '-E', '-e', pattern, '--', '.', ':!package-lock.json', `:!${SELF}`],
    { encoding: 'utf8', cwd: ROOT },
  );
  if (r.status !== 0 && r.status !== 1) throw new Error(`git grep failed: ${r.stderr}`);
  return (r.stdout || '').trim();
}

let failed = false;
for (const p of PATTERNS) {
  let out = '';
  try {
    out = gitGrep(p);
  } catch (e) {
    console.error(`[secrets-scan] scan error for ${p}: ${e.message}`);
    failed = true;
    continue;
  }
  const hits = out
    .split('\n')
    .filter(Boolean)
    .filter((l) => !isAllowed(l));
  if (hits.length > 0) {
    console.error(`[secrets-scan] FAIL pattern /${p}/ matched:\n${hits.join('\n')}`);
    failed = true;
  }
}
// mongodb URIs with embedded credentials (any file except docker-compose example host form)
try {
  const out = gitGrep('mongodb(\\+srv)?://[^\\s"\']*:[^\\s"\']+@[^\\s"\']+');
  const hits = out
    .split('\n')
    .filter(Boolean)
    .filter((l) => !l.includes('.env.example') && !l.includes('scan-secrets'));
  if (hits.length > 0) {
    console.error(`[secrets-scan] FAIL credentialed mongo URI:\n${hits.join('\n')}`);
    failed = true;
  }
} catch (e) {
  console.error(`[secrets-scan] scan error (mongo): ${e.message}`);
  failed = true;
}
// A local .env is expected and gitignored; only a *tracked* one is a leak.
const tracked = spawnSync('git', ['ls-files', '--error-unmatch', '.env'], {
  encoding: 'utf8',
  cwd: ROOT,
});
if (tracked.status === 0) {
  console.error('[secrets-scan] FAIL: .env is tracked by git — use env vars, never commit .env');
  failed = true;
}
if (failed) process.exit(1);
console.log('[secrets-scan] OK — no secrets found');
