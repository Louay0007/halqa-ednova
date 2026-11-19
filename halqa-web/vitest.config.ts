import { defineConfig } from 'vitest/config';

/**
 * Unit tests cover the pure layer (`lib/`) — the API client's retry/timeout/
 * abort policy, i18n parity and the degradation copy. Screens are covered by
 * Playwright later (plan §6.7); this config deliberately stays node-fast.
 */
export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.ts'],
    globals: false,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      reporter: ['text-summary'],
    },
  },
});
