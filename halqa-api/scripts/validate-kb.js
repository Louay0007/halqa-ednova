#!/usr/bin/env node
// seed:kb gate — validates kb/seeds/*.json + SOURCES.md coverage.
// Exit 1 on any error (CI). Usage: node scripts/validate-kb.js [kbDir]
const fs = require('fs');
const path = require('path');

const kbDir = process.argv[2] ?? path.join(__dirname, '..', 'kb', 'seeds');
const sourcesFile = path.join(path.dirname(kbDir), 'SOURCES.md');
const KINDS = ['lesson', 'example', 'probe', 'misconception', 'glossary', 'visual_desc'];
const LANGS = ['fr', 'ar', 'darija', 'en'];
const REQUIRED = ['chunk_id', 'topic', 'lang', 'level', 'kind', 'title', 'text', 'claims', 'source', 'license'];

const errors = [];
const seen = new Map();

for (const f of fs.readdirSync(kbDir).filter((x) => x.endsWith('.json'))) {
  let docs;
  try {
    docs = JSON.parse(fs.readFileSync(path.join(kbDir, f), 'utf8'));
  } catch (e) {
    errors.push(`${f}: invalid JSON (${e.message})`);
    continue;
  }
  if (!Array.isArray(docs)) {
    errors.push(`${f}: top level must be an array`);
    continue;
  }
  for (const [i, d] of docs.entries()) {
    const where = `${f}[${i}]`;
    for (const k of REQUIRED) if (!(k in d)) errors.push(`${where}: missing field ${k}`);
    if (d.chunk_id && seen.has(d.chunk_id)) errors.push(`${where}: duplicate chunk_id ${d.chunk_id}`);
    if (d.chunk_id) seen.set(d.chunk_id, where);
    if (d.kind && !KINDS.includes(d.kind)) errors.push(`${where}: bad kind ${d.kind}`);
    if (d.lang && !LANGS.includes(d.lang)) errors.push(`${where}: bad lang ${d.lang}`);
    if (d.claims && !Array.isArray(d.claims)) errors.push(`${where}: claims must be an array`);
    if (d.kind === 'probe' && !('answer' in d)) errors.push(`${where}: probe without answer`);
    if (d.source && !['synthetic-team-written', 'public-domain'].includes(d.source)) {
      errors.push(`${where}: bad source ${d.source}`);
    }
  }
}

// SOURCES.md coverage both ways
const table = fs.readFileSync(sourcesFile, 'utf8');
const tableIds = new Set(
  [...table.matchAll(/^\|\s*([a-z0-9_-]+)\s*\|/gmi)]
    .map((m) => m[1])
    .filter((id) => id !== 'chunk_id' && !/^-+$/.test(id)),
);
for (const id of seen.keys()) if (!tableIds.has(id)) errors.push(`SOURCES.md: missing row for ${id}`);
for (const id of tableIds) if (!seen.has(id)) errors.push(`SOURCES.md: row without chunk file: ${id}`);

// Blueprint minimums
const bs = [...seen.keys()].filter((id) => id.startsWith('bs-'));
const frac = [...seen.keys()].filter((id) => id.startsWith('frac-'));
if (bs.length < 24) errors.push(`binary_search chunks: ${bs.length} < 24`);
for (const l of LANGS) {
  const n = bs.filter((id) => id.startsWith(`bs-${l}-`) || (l === 'en' && id.startsWith('bs-en'))).length;
  if (n < 6) errors.push(`binary_search/${l}: ${n} < 6`);
}
if (frac.length < 12) errors.push(`fractions chunks: ${frac.length} < 12`);

if (errors.length > 0) {
  console.error(`[seed:kb] FAIL (${errors.length}):\n${errors.join('\n')}`);
  process.exit(1);
}
console.log(`[seed:kb] OK — ${seen.size} chunks (${bs.length} bs, ${frac.length} frac), SOURCES coverage 100%`);
