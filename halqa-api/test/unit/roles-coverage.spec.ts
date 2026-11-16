import { readdirSync, readFileSync, statSync } from 'fs';
import * as path from 'path';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../../src/security/roles.decorator';

/**
 * Static gate: authentication is opt-out, never opt-in.
 *
 * `TokenGuard` is registered as an `APP_GUARD` and denies any route that does not
 * carry `@Public()`, so a controller without `@Roles` is now *guarded*, not open.
 * This gate pins the other half: every controller has to declare its intent — one
 * `@Roles(...)` for each `@Controller(...)`, or an explicit `@Public()`.
 *
 * A decorator applied at runtime would fool this check; the codebase does not do that.
 */
const SRC = path.resolve(__dirname, '../../src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === 'node_modules' ? [] : walk(full);
    return name.endsWith('.controller.ts') ? [full] : [];
  });
}

describe('Auth coverage', () => {
  it('every controller is either role-guarded or explicitly public', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const src = readFileSync(file, 'utf8');
      const controllers = (src.match(/@Controller\(/g) ?? []).length;
      const guarded = (src.match(/@Roles\(/g) ?? []).length;
      const isPublic = (src.match(/@Public\(\)/g) ?? []).length > 0;
      if (guarded === 0 && !isPublic) offenders.push(`${path.relative(SRC, file)} (unguarded)`);
      else if (!isPublic && guarded < controllers) offenders.push(`${path.relative(SRC, file)} (${guarded}/${controllers})`);
    }
    expect(offenders).toEqual([]);
  });

  it('mentor and circle routes are not on a public allow-list any more', () => {
    // Regression guard: these two files used to be skipped by basename.
    for (const name of ['mentor.controller.ts', 'circle.controller.ts']) {
      const src = readFileSync(path.join(SRC, ...find(name)), 'utf8');
      expect(src).toMatch(/@Roles\(|@Public\(\)/);
    }
  });

  it('the metadata keys are stable', () => {
    // The guard reads these keys; renaming one silently disables every check.
    expect(ROLES_KEY).toBe('halqa_roles');
    expect(IS_PUBLIC_KEY).toBe('halqa_public');
  });
});

function find(name: string): string[] {
  const hit = walk(SRC).find((f) => path.basename(f) === name);
  if (!hit) throw new Error(`missing ${name}`);
  return path.relative(SRC, hit).split(path.sep);
}
