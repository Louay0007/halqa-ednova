import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Unit and accessibility tests.
 *
 * `lib/` is covered by the pure tests (API client retry/timeout/abort policy,
 * i18n parity, degradation copy). The JSX transform is enabled because the axe
 * gate (§6.6) renders the 404 and crash card for real rather than asserting
 * hand-counted attributes. Live session screens still need a server, so they
 * remain a Playwright concern (§6.7).
 */
export default defineConfig({
  plugins: [react()],
  // `test/` is outside both tsconfigs (tsconfig.app.json includes only `src`), so
  // esbuild has no `jsx` setting to inherit here and would fall back to the
  // classic runtime, which needs React in scope. State it once.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    globals: false,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      reporter: ['text-summary'],
    },
  },
});
