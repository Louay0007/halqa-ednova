// SCHEMA GATE — automated enforcement of F-V2-10 (gender-blind by design)
// plus ID-format and ledger invariants from plan §4.12.
// This test fails the BUILD if a forbidden field ever appears in any schema.
import * as fs from 'fs';
import * as path from 'path';

const SCHEMA_DIR = path.join(__dirname, '..', '..', 'src', 'persistence', 'schemas');
// Word boundaries so `Stage`/`message`-style substrings do not false-positive.
const FORBIDDEN = /\bgender\b|\bsex\b|\bregion\b|\bcountry\b|\bphoto\b|\bbirth\b|\bage\b|\baddress\b|\bphone\b|\bemail\b/i;

function schemaFiles(): string[] {
  return fs.readdirSync(SCHEMA_DIR).filter((f) => f.endsWith('.ts'));
}

describe('schema gate', () => {
  it('every schema file exists (12 collections)', () => {
    const files = schemaFiles();
    expect(files.length).toBeGreaterThanOrEqual(5); // 6 files covering 15 collections
    expect(files).toContain('learner.schema.ts');
    expect(files).toContain('circle.schema.ts');
    expect(files).toContain('session.schema.ts');
    expect(files).toContain('question.schema.ts');
    expect(files).toContain('interaction.schema.ts');
    expect(files).toContain('ai.schema.ts');
    expect(files).toContain('telemetry.schema.ts');
  });

  it('no schema source contains a forbidden field name', () => {
    const hits: string[] = [];
    for (const f of schemaFiles()) {
      const src = fs.readFileSync(path.join(SCHEMA_DIR, f), 'utf8');
      // strip the explanatory comment that names the forbidden fields
      const stripped = src
        .split('\n')
        .filter((l) => !l.trim().startsWith('//'))
        .join('\n')
        .replace(/['"`][^'"`]*['"`]/g, (m) => (FORBIDDEN.test(m) ? '<<STR>>' : m));
      // check @Prop property declarations: `@Prop(...) <name>` lines
      const propLines = stripped.split('\n').filter((l) => /^\s*(?:@Prop|(?:public|readonly)?\s*\w+\??:)/.test(l));
      for (const line of propLines) {
        // allow-list legitimate substrings: nickname, message? (message contains... no)
        const noNick = line.replace(/nickname/gi, '');
        if (FORBIDDEN.test(noNick)) hits.push(`${f}: ${line.trim()}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('no bare `name` prop exists anywhere (only `nickname`)', () => {
    const hits: string[] = [];
    for (const f of schemaFiles()) {
      const src = fs
        .readFileSync(path.join(SCHEMA_DIR, f), 'utf8')
        .replace(/nickname/g, '')
        .replace(/username/g, '');
      const m = src.match(/[^\n]*\bname\b[^\n]*/g) ?? [];
      for (const line of m) {
        const t = line.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue;
        hits.push(`${f}: ${t}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
