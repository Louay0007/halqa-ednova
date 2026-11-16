import { readdirSync, readFileSync, statSync } from 'fs';
import * as path from 'path';
import { ROLES_KEY } from '../../src/security/roles.decorator';

/**
 * Static gate: every controller that mutates learner-owned state must carry `@Roles`.
 * `Roles()` was declared but applied nowhere, so the bearer token was never enforced.
 * A decorator applied at runtime would fool this check; the codebase does not do that.
 */
const SRC = path.resolve(__dirname, '../../src');

/** Public by design: probes, the auth handshake, catalog reads, the board and metrics. */
const PUBLIC = new Set([
  'health.controller.ts',
  'chaos.controller.ts',
  'auth.controller.ts',
  'knowledge.controller.ts',
  'analytics.controller.ts',
  'telemetry.controller.ts',
  'workshop.controller.ts',
  'dashboard.controller.ts',
  'circle.controller.ts',
  'mentor.controller.ts',
]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === 'node_modules' ? [] : walk(full);
    return name.endsWith('.controller.ts') ? [full] : [];
  });
}

describe('Roles coverage', () => {
  it('every non-public controller applies @Roles', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      if (PUBLIC.has(path.basename(file))) continue;
      const src = readFileSync(file, 'utf8');
      const controllers = (src.match(/@Controller\(/g) ?? []).length;
      const guarded = (src.match(/@Roles\(/g) ?? []).length;
      if (guarded === 0 || guarded < controllers) offenders.push(`${path.relative(SRC, file)} (${guarded}/${controllers})`);
    }
    expect(offenders).toEqual([]);
  });

  it('the roles metadata key is stable', () => {
    // The guard reads this key; renaming it silently disables every check.
    expect(ROLES_KEY).toBe('halqa_roles');
  });
});
