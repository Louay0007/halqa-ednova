import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SCRIPT = path.join(__dirname, '..', '..', 'scripts', 'validate-kb.js');
const KB = path.join(__dirname, '..', '..', 'kb', 'seeds');

describe('seed:kb gate', () => {
  it('passes on the real seed dir (39 chunks, 100% SOURCES coverage)', () => {
    const out = execFileSync('node', [SCRIPT, KB], { encoding: 'utf8' });
    expect(out).toMatch(/39 chunks/);
    expect(out).toMatch(/SOURCES coverage 100%/);
  });
  it('fails on duplicate ids, missing answers, bad kinds', () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'kbparent-'));
    const sub = path.join(parent, 'seeds');
    fs.mkdirSync(sub);
    fs.writeFileSync(
      path.join(sub, 'a.json'),
      JSON.stringify([
        { chunk_id: 'x-01', topic: 't', lang: 'en', level: 'intro', kind: 'probe', title: 't', text: 't', claims: [], source: 'synthetic-team-written', license: 'own' },
        { chunk_id: 'x-01', topic: 't', lang: 'xx', level: 'intro', kind: 'nope', title: 't', text: 't', claims: [], source: 'synthetic-team-written', license: 'own' },
      ]),
    );
    fs.writeFileSync(path.join(parent, 'SOURCES.md'), '| chunk_id | source | license |\n|---|---|---|\n| x-01 | synthetic-team-written | own |\n');
    let failed = '';
    try {
      execFileSync('node', [SCRIPT, sub], { encoding: 'utf8', stdio: 'pipe' });
    } catch (e) {
      failed = (e as { stderr?: string }).stderr ?? String(e);
    }
    expect(failed).toMatch(/duplicate chunk_id x-01/);
    expect(failed).toMatch(/probe without answer/);
    expect(failed).toMatch(/bad kind nope/);
    expect(failed).toMatch(/bad lang xx/);
  });
});
