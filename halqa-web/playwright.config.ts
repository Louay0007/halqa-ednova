import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end suite (§6.7), covering the flows the plan names: enter → create →
 * lobby → session → debrief, join by code, solo, DNA, and offline reload.
 *
 * The suite is split by what it needs. Screens that render without a backend
 * (landing, 404, route gating, offline reload) run everywhere, including CI with
 * no API. Flows that need a live API are skipped unless `E2E_API` is set, because
 * a suite that silently passes against an unreachable API proves nothing — the
 * failure mode is a green run that never touched the thing under test.
 *
 *   npm run e2e                       # no-backend checks only
 *   E2E_API=http://localhost:3000/api/v1 E2E_WEB=http://localhost:5173 npm run e2e
 */
const WEB = process.env.E2E_WEB ?? 'http://localhost:4173';

/**
 * The API the *bundle* should point at. `E2E_API` drives both the build and the
 * decision to run the backend-dependent specs, so they cannot disagree: a run
 * that builds against localhost while skipping the flow tests is the confusing
 * middle state this avoids.
 */
const API = process.env.E2E_API ?? process.env.VITE_API_BASE;

export default defineConfig({
  testDir: './e2e',
  // Serial: these flows create circles on a shared backend, and a parallel run
  // would have two contexts claiming the same join code.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,
  use: {
    baseURL: WEB,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // The product is a phone-first classroom app; test the shape it ships in.
    ...devices['Pixel 5'],
  },
  projects: [{ name: 'chromium', use: { ...devices['Pixel 5'] } }],
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        // Build output, not the dev server: `import.meta.env.DEV` gates /lab, and
        // testing the dev server would test a route the deployed bundle lacks.
        command: 'npm run build && npx vite preview --port 4173 --strictPort',
        url: WEB,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: { VITE_API_BASE: API ?? 'http://localhost:3000/api/v1' },
      },
});

export const hasBackend = Boolean(API);
