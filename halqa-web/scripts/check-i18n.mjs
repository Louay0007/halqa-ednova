#!/usr/bin/env node
/**
 * i18n parity gate (spec §8.2 / plan §6.7).
 *
 * The four-language claim is a product invariant, and it has silently broken
 * before: a key added with only `en` renders the raw key to Arabic, Darija and
 * French learners. This asserts every key has all four languages, that no key is
 * duplicated (a duplicate would shadow the first and drop its translations), and
 * that no language value is empty.
 *
 * Parses the STRINGS literal directly rather than importing it, so it runs with
 * no build step and no dependencies — the same reason `lint:secrets` is plain JS.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(here, '..', 'src', 'lib', 'i18n.ts');
const LANGS = ['en', 'fr', 'ar', 'darija'];

const text = readFileSync(SOURCE, 'utf8');

const start = text.indexOf('STRINGS');
if (start === -1) fail(['Could not find the STRINGS table in src/lib/i18n.ts']);
const end = text.indexOf('\n};', start);
if (end === -1) fail(['Could not find the end of the STRINGS table']);
const body = text.slice(start, end);

/** Each key starts at two-space indent with `key: {`. */
const keyRe = /^ {2}([a-z0-9_]+): \{/gm;
const keys = [...body.matchAll(keyRe)].map((m) => m[1]);

const problems = [];

const seen = new Set();
for (const k of keys) {
  if (seen.has(k)) problems.push(`duplicate key "${k}" — the later block shadows the earlier one`);
  seen.add(k);
}

if (keys.length === 0) problems.push('Parsed 0 keys — the STRINGS format probably changed.');

for (const k of keys) {
  const i = body.indexOf(`\n  ${k}: {`);
  if (i === -1) continue;
  const lineEnd = body.indexOf('\n', i + 1);
  const firstLine = body.slice(i, lineEnd === -1 ? body.length : lineEnd);
  // Single-line entries (`key: { en: '..', fr: '..' },`) end on the same line as
  // they start. Only multi-line entries need the `\n  },` scan — using that scan
  // for a single-line key would swallow every following key into its scope and
  // make every check pass. (This was the bug in the first version.)
  let scope;
  if (firstLine.trimEnd().endsWith('},')) {
    scope = firstLine;
  } else {
    const close = body.indexOf('\n  },', i);
    scope = body.slice(i, close === -1 ? body.length : close);
  }
  for (const lang of LANGS) {
    const m = scope.match(new RegExp(`\\b${lang}:\\s*'((?:[^'\\\\]|\\\\.)*)'`));
    if (!m) problems.push(`${k}: missing "${lang}"`);
    else if (m[1].trim() === '') problems.push(`${k}: empty "${lang}"`);
  }
}

function fail(lines) {
  console.error('i18n parity FAILED:');
  for (const l of lines) console.error(`  - ${l}`);
  process.exit(1);
}

if (problems.length) fail(problems);

console.log(`i18n parity OK — ${keys.length} keys × ${LANGS.length} languages, no gaps.`);
