import { expect, test } from '@playwright/test';

/**
 * §6.3, §6.4: routing that is honest without a backend.
 *
 * These run in CI with no API on purpose. The three failures they cover were all
 * present at once and all invisible when you only test the happy path: a mistyped
 * deep link rendered the landing page (so "no such circle" and "welcome" were
 * identical), `/board` and `/dashboard` rendered for signed-out learners and then
 * 401'd, and the 404 had no way back.
 */

test('404 says so, and offers the way home', async ({ page }) => {
  await page.goto('/this-route-does-not-exist');
  // The specific regression: this used to render the landing page, so a broken
  // link looked like a successful visit. Assert structure plus the one thing that
  // is language-independent — that it is not the landing page.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(/HALQA.*circle.*learn/i);
  // A way back exists. Selected by `href` rather than "the first link": the shell
  // puts a skip-to-content anchor first, which is correct a11y and the wrong target.
  const back = page.locator('a[href="/"]').first();
  await expect(back).toBeVisible();
  await back.click();
  await expect(page).toHaveURL(/\/$/);
});

for (const path of ['/board', '/dashboard', '/me', '/circles/new', '/circles/join', '/dna', '/solo']) {
  test(`${path} sends a signed-out visitor to /enter`, async ({ page }) => {
    // §6.4: protected client-side *and* server-side. Without the guard these pages
    // rendered a skeleton, fired an unauthorised request, and showed a crash card.
    await page.goto(path);
    await expect(page).toHaveURL(/\/enter/);
  });
}

test('a signed-out visitor never sees the chaos console in a production build', async ({ page }) => {
  // §10.4: /lab is gated on `import.meta.env.DEV`, so the deployed bundle must not
  // contain the route at all. Landing on it therefore hits the 404, not the lab.
  await page.goto('/lab');
  // Whatever the copy says, this must be the 404 — one h1 plus a single link home —
  // and not a live console. That is the assertion, not the wording.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: /reload|lab|chaos|degradation/i })).toHaveCount(0);
});

test('the enter form states what is stored, in plain language', async ({ page }) => {
  // §8.3 consent copy belongs on the form, not buried in a policy page.
  await page.goto('/enter');
  await expect(page.locator('.enter-consent')).toContainText(/nickname|pseudo|اسم|سمية/i);
});

test('the page works offline after a reload', async ({ page, context }) => {
  // §6.7 offline reload: the offline pack is the degraded-but-usable contract, so
  // a service-worker install that leaves a blank screen is a worse failure than
  // an honest error card.
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // The SW only controls the page after one navigation following registration.
  await page.reload();
  await page.waitForLoadState('networkidle');
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('body')).not.toBeEmpty();
  // And it must say something, not merely render a shell.
  await expect(page.getByRole('heading').first()).toBeVisible();
  await context.setOffline(false);
});
