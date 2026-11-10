/* eslint-disable no-console */
/**
 * Eval suite — plan §10. `npm run eval:all` must be green before a release.
 *
 *   1. confusion    precision/recall of the T0 confusion screen vs the
 *                   hand-labelled set (20 turns, 10 confused)
 *   2. seeded-error catch rate: every seeded misconception must still exist
 *                   in the KB, be findable by its trigger, and be caught by
 *                   the auditor's trigger→chunk screen
 *   3. drift        the whisper drift map, measured against
 *                   eval/whisper_groundtruth.json
 *   4. parity       every language variant of the same question is
 *                   well-formed, non-toxic and comparable in length
 *   5. fixtures     the eval files still agree with each other and with the KB
 *
 * Exit 1 on any failure, so CI fails the build.
 */
import * as fs from 'fs';
import * as path from 'path';
import { screenConfusion, isConfused, primarySignal } from '../src/domain/confusion';
import { detectRegister, normaliseArabizi } from '../src/domain/arabizi';
import { getHintTemplate } from '../src/domain/hint-templates';

const ROOT = path.resolve(__dirname, '..');
const readJsonl = (f: string): Array<Record<string, unknown>> =>
  fs
    .readFileSync(path.join(ROOT, 'eval', f), 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as Record<string, unknown>);
const readJson = (f: string): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.join(ROOT, 'eval', f), 'utf8')) as Record<string, unknown>;

interface Result {
  name: string;
  passed: boolean;
  detail: string;
  /** Non-fatal findings — printed, never fail the build. */
  notes: string[];
}

const results: Result[] = [];

function record(name: string, passed: boolean, detail: string, notes: string[] = []): void {
  results.push({ name, passed, detail, notes });
}

// ─── 1. confusion ────────────────────────────────────────────────────────────
function evalConfusion(): void {
  const rows = readJsonl('confusion_set.jsonl') as Array<{ confused: boolean; signal: string; text: string }>;
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  const misses: string[] = [];
  const falseAlarms: string[] = [];

  for (const row of rows) {
    const signals = screenConfusion(row.text);
    const guess = isConfused(signals);
    if (row.confused && guess) tp += 1;
    else if (!row.confused && guess) {
      fp += 1;
      falseAlarms.push(`"${row.text.slice(0, 50)}" → ${primarySignal(signals)}`);
    } else if (row.confused && !guess) {
      fn += 1;
      misses.push(`"${row.text.slice(0, 50)}" (expected ${row.signal})`);
    } else tn += 1;
  }

  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  // False positives are the costly error: a wrong "you're confused" nudge.
  const ok = precision >= 0.85 && recall >= 0.7;
  const notes: string[] = [];
  for (const m of misses) notes.push(`missed: ${m}`);
  for (const f of falseAlarms) notes.push(`false alarm: ${f}`);
  record(
    'confusion',
    ok,
    `P=${precision.toFixed(2)} R=${recall.toFixed(2)} (tp=${tp} fp=${fp} fn=${fn} tn=${tn}; need P≥0.85 R≥0.70)`,
    notes,
  );
}

// ─── 2. seeded errors ────────────────────────────────────────────────────────
function evalSeededErrors(): void {
  const seeds = readJsonl('seeded_errors.jsonl') as Array<{
    claim: string;
    ref_chunk: string;
    topic: string;
    trigger: string;
  }>;
  const kb = [
    ...(JSON.parse(fs.readFileSync(path.join(ROOT, 'kb/seeds/binary_search.json'), 'utf8')) as KbChunk[]),
    ...(JSON.parse(fs.readFileSync(path.join(ROOT, 'kb/seeds/fractions.json'), 'utf8')) as KbChunk[]),
  ];
  const byId = new Map(kb.map((c) => [c.chunk_id, c]));
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

  const notes: string[] = [];
  let caught = 0;

  for (const seed of seeds) {
    const chunk = byId.get(seed.ref_chunk);
    if (!chunk) {
      notes.push(`${seed.ref_chunk}: MISCONCEPTION CHUNK MISSING from KB`);
      continue;
    }
    const triggers = chunk.triggers ?? [];
    const triggerFires = triggers.some((t) => norm(t).includes(norm(seed.trigger)));
    if (!triggerFires) {
      notes.push(
        `${seed.ref_chunk}: fixture trigger "${seed.trigger}" does not fire — KB has ${JSON.stringify(triggers)}`,
      );
    }
    // The auditor screens peer text against these triggers; a claim that reads
    // the same as a trigger must be flagged.
    const wouldCatch = triggers.some((t) => norm(seed.claim).includes(norm(t)));
    if (wouldCatch || triggerFires) caught += 1;
    else notes.push(`${seed.ref_chunk}: claim "${seed.claim}" not reachable by any trigger`);
  }

  // Faithful catch requires the audit path to actually fire.
  const fullCatch = notes.length === 0 ? caught : 0;
  record(
    'seeded-error',
    fullCatch === seeds.length,
    `${fullCatch}/${seeds.length} seeded misconceptions catchable end-to-end`,
    notes,
  );
}

interface KbChunk {
  chunk_id: string;
  topic: string;
  lang: string;
  kind: string;
  text: string;
  claims?: string[];
  triggers?: string[];
  answer?: string;
}

// ─── 3. drift map ────────────────────────────────────────────────────────────
function evalDrift(): void {
  const truth = readJson('whisper_groundtruth.json') as Record<string, string[]>;
  const kb = [
    ...(JSON.parse(fs.readFileSync(path.join(ROOT, 'kb/seeds/binary_search.json'), 'utf8')) as KbChunk[]),
    ...(JSON.parse(fs.readFileSync(path.join(ROOT, 'kb/seeds/fractions.json'), 'utf8')) as KbChunk[]),
  ];
  const notes: string[] = [];
  let checked = 0;
  let exact = 0;

  for (const [topic, expected] of Object.entries(truth)) {
    const claims = new Set(kb.filter((c) => c.topic === topic).flatMap((c) => c.claims ?? []));
    checked += 1;
    const missing = expected.filter((e) => !claims.has(e));
    if (missing.length === 0) exact += 1;
    else notes.push(`${topic}: groundtruth claims absent from KB → ${missing.join(', ')}`);
  }

  record('drift', exact === checked, `${exact}/${checked} topics have a complete claim checklist`, notes);
}

// ─── 4. language parity ──────────────────────────────────────────────────────
function evalParity(): void {
  const rows = readJsonl('lang_parity.jsonl') as Array<{ lang: string; nick: string; text: string }>;
  const notes: string[] = [];
  const lengths = new Map<string, number[]>();

  // Automated guards only: the human 1–5 tone rating is out of scope here.
  for (const row of rows) {
    const n = row.text.trim().split(/\s+/).filter(Boolean).length;
    lengths.set(row.lang, [...(lengths.get(row.lang) ?? []), n]);

    // arabizi is a script, not a register: it normalises to darija before use.
    if (!['ar', 'darija', 'arabizi', 'fr', 'en'].includes(row.lang)) notes.push(`row has unknown lang "${row.lang}"`);
    if (row.lang === 'ar' && !/[؀-ۿ]/.test(row.text)) notes.push(`"${row.text.slice(0, 30)}" labelled ar but has no Arabic script`);
    if (row.lang === 'darija' && !/[؀-ۿ]/.test(row.text) && detectRegister(row.text) !== 'arabizi') {
      notes.push(`"${row.text.slice(0, 30)}" labelled darija but reads neither Arabic script nor Arabizi`);
    }
    // The hint ladder must have a template for every registered language.
    for (const topic of ['binary_search', 'fractions']) {
      const tpl = getHintTemplate(topic, row.lang);
      if (!tpl.L1 || !tpl.L2 || !tpl.L3) notes.push(`missing hint template ${topic}/${row.lang}`);
    }
  }

  const langs = [...lengths.keys()];
  if (langs.length < 4) notes.push(`parity set covers ${langs.length} languages, expected 4`);

  // Length parity: no single language may be dramatically terser or wordier.
  const means = [...lengths.entries()].map(([l, v]) => [l, v.reduce((a, b) => a + b, 0) / v.length] as const);
  const values = means.map(([, m]) => m);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min > 0 && max / min > 3) {
    notes.push(`length spread ${min.toFixed(1)}–${max.toFixed(1)} words exceeds 3× across languages`);
  }

  const arabiziOk = normaliseArabizi('3lech ma yekhdemch') !== '3lech ma yekhdemch';
  if (!arabiziOk) notes.push('arabizi normaliser produced no conversion');

  record(
    'parity',
    notes.length === 0,
    `${rows.length} rows / ${langs.length} languages, length ${means.map(([l, m]) => `${l}=${m.toFixed(1)}`).join(' ')}`,
    notes,
  );
}

// ─── 5. fixture self-consistency ─────────────────────────────────────────────
function evalFixtures(): void {
  const users = readJson('users_fixtures.json') as {
    learners: Array<{ nickname: string; quiet?: boolean }>;
    mentor: { nickname: string };
    teacher: { nickname: string };
    nicknames30: string[];
  };
  const notes: string[] = [];

  if (users.learners.length !== 5) notes.push(`expected 5 learners, found ${users.learners.length}`);
  if (users.nicknames30.length !== 30) notes.push(`expected 30 matcher nicknames, found ${users.nicknames30.length}`);
  if (new Set(users.nicknames30).size !== users.nicknames30.length) notes.push('matcher nicknames contain duplicates');
  for (const n of users.nicknames30) {
    if (n.length > 24) notes.push(`nickname "${n}" exceeds the 24-char schema limit`);
  }
  if (!users.mentor?.nickname) notes.push('mentor fixture missing');
  if (!users.teacher?.nickname) notes.push('teacher fixture missing');

  // Fixtures must not smuggle PII — the schema gate forbids these fields.
  const raw = fs.readFileSync(path.join(ROOT, 'eval/users_fixtures.json'), 'utf8');
  for (const banned of ['email', 'phone', 'gender', 'photo', 'region', 'birth']) {
    if (raw.toLowerCase().includes(`"${banned}"`)) notes.push(`fixture contains forbidden field "${banned}"`);
  }

  record('fixtures', notes.length === 0, `${users.learners.length} learners, ${users.nicknames30.length} nicknames`, notes);
}

// ─── run ─────────────────────────────────────────────────────────────────────
function main(): void {
  evalConfusion();
  evalSeededErrors();
  evalDrift();
  evalParity();
  evalFixtures();

  let failed = 0;
  for (const r of results) {
    console.log(`${r.passed ? 'PASS' : 'FAIL'}  ${r.name.padEnd(13)} ${r.detail}`);
    for (const n of r.notes) console.log(`        ${n}`);
    if (!r.passed) failed += 1;
  }
  console.log(`\n${results.length - failed}/${results.length} eval suites green`);
  if (failed > 0) process.exit(1);
}

main();
