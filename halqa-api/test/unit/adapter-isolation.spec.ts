// Architectural gate: the provider adapter is the ONLY file that may know
// model names/keys. No module outside src/ai may import it.
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.join(__dirname, '..', '..', 'src');

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...tsFiles(p));
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

describe('adapter isolation gate', () => {
  it('only src/ai files import the provider adapter', () => {
    const offenders: string[] = [];
    for (const f of tsFiles(SRC)) {
      if (f.includes(`${path.sep}ai${path.sep}`)) continue;
      const src = fs.readFileSync(f, 'utf8');
      // flag real imports, not doc comments mentioning the path
      if (/(?:import|require)\s*\(?[^'"]*['"][^'"]*ai\/adapter\/provider\.adapter/.test(src)) {
        offenders.push(path.relative(SRC, f));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('only the adapter + validated config reference model env keys', () => {
    const offenders: string[] = [];
    for (const f of tsFiles(SRC)) {
      if (f.endsWith('provider.adapter.ts')) continue;
      if (f.endsWith(path.join('core', 'config', 'app-config.ts'))) continue; // validated config only (rule 3)
      const src = fs.readFileSync(f, 'utf8');
      if (/COMPACT_MODEL|LARGER_MODEL|PROVIDER_API_KEY|PROVIDER_BASE_URL/.test(src)) {
        offenders.push(path.relative(SRC, f));
      }
    }
    expect(offenders).toEqual([]);
  });
});
