#!/usr/bin/env node
/**
 * In-circle UI/UX audit. Walks the real flow (guest entry → circle → session →
 * debrief) and screenshots every page at desktop and mobile, so defects are
 * judged from the running app rather than from the stylesheet.
 *
 *   cd demo && node audit-circle.cjs
 *
 * Output: demo/shots/audit-<page>-<viewport>.png  (+ a printed page inventory)
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:5173';
const API = process.env.API || 'http://localhost:3000/api/v1';
const OUT = path.join(__dirname, 'shots', 'audit');
const VIEWPORTS = [
  { name: 'desk', width: 1440, height: 900 },
  { name: 'mob', width: 390, height: 844 },
];

const tail = [];
function note(line) {
  tail.push(line);
  console.log(line);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const results = [];

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    const consoleErrors = [];
    p.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
    p.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 200)}`));

    const snap = async (name, full = false) => {
      const file = path.join(OUT, `audit-${name}-${vp.name}.png`);
      await p.waitForTimeout(700);
      await p.screenshot({ path: file, fullPage: full });
      // Overflow is the most common mobile defect: measure it, do not eyeball it.
      const o = await p.evaluate(() => {
        const de = document.documentElement;
        return { scrollW: de.scrollWidth, clientW: de.clientWidth, over: de.scrollWidth - de.clientWidth };
      });
      results.push({ viewport: vp.name, page: name, ...o });
      note(`  ${vp.name.padEnd(5)} ${name.padEnd(24)} overflow=${o.over > 1 ? `${o.over}px` : 'ok'}`);
      return file;
    };

    try {
      // 1. Landing
      await p.goto(BASE, { waitUntil: 'networkidle' });
      await snap('01-landing');

      // 2. Guest entry
      await p.goto(`${BASE}/enter?next=/dna`, { waitUntil: 'networkidle' });
      await snap('02-enter');
      await p.locator('.enter-tab').nth(2).click();
      await p.waitForSelector('#nick');
      await p.fill('#nick', `Rim-${vp.name}`);
      await snap('03-enter-filled');

      const auth = p.waitForResponse((r) => r.url().includes('/auth/'), { timeout: 20000 });
      await p.locator('.enter-submit').click();
      await auth;
      await p.waitForFunction(() => location.pathname === '/dna', null, { timeout: 20000 });

      // 3. DNA passport
      await snap('04-dna');
      const sets = p.locator('fieldset.dna-step');
      const n = await sets.count();
      for (let i = 0; i < n; i += 1) {
        await sets.nth(i).locator('input[type="radio"]').first().check({ force: true });
      }
      await snap('05-dna-filled');

      // 4. Board (post-DNAs land here)
      await p.goto(`${BASE}/board`, { waitUntil: 'networkidle' }).catch(() => undefined);
      await snap('06-board');

      // 5. New circle
      await p.goto(`${BASE}/circles/new`, { waitUntil: 'networkidle' });
      await snap('07-circle-new');
      await p.locator('input[name="topic"][value="binary_search"]').check({ force: true }).catch(() => undefined);
      await p.fill('#host', 'Rim');
      await p.locator('#win').fill('30').catch(() => undefined);
      await snap('08-circle-new-filled');
      await p.locator('form button[type="submit"]').click();
      await p.waitForSelector('.code-big', { timeout: 20000 });
      await snap('09-circle-code');

      const ids = await p.evaluate(async (apiBase) => {
        const token = sessionStorage.getItem('halqa.token') || '';
        const id = sessionStorage.getItem('halqa.circle') || '';
        const r = await fetch(`${apiBase}/circles/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        return { joinCode: (await r.json()).joinCode, circleId: id };
      }, API);

      // 6. Lobby
      await p.goto(`${BASE}/c/${ids.circleId}`, { waitUntil: 'networkidle' });
      await snap('10-lobby');

      // 7. Session room
      const start = p.locator('button.btn:not(.btn-ghost)').first();
      await start.click();
      await p.waitForFunction(() => /^\/c\/[^/]+\/s\//.test(location.pathname), null, { timeout: 25000 });
      const sessionPath = new URL(p.url()).pathname;
      await p.waitForSelector('#q', { timeout: 20000 });
      await snap('11-session-empty');

      await p.fill('#q', '3lech binary search tehtej liste mrattba?');
      await snap('12-session-composing');
      await p.locator('form.composer button[type="submit"]').click();
      await p.waitForSelector('.qcard.q-open', { timeout: 20000 });
      await snap('13-session-open-window', true);

      // Let the 30s peer window expire on its own: the hint path resolves the
      // card with no second identity and no fake peer answer.
      await p.waitForSelector('.qcard.q-resolved', { timeout: 60000 });
      await snap('14-session-resolved', true);

      // Coach panel (private nudge flow) if the members rail exposes it.
      const coachBtn = p.locator('.member-coach').first();
      if (await coachBtn.count()) {
        await coachBtn.click().catch(() => undefined);
        await p.waitForTimeout(1200);
        await snap('15-session-coach', true);
        await p.keyboard.press('Escape').catch(() => undefined);
      }

      // 8. Debrief
      await p.goto(`${BASE}${sessionPath}/debrief`, { waitUntil: 'networkidle' });
      await snap('16-debrief', true);

      // 9. Dashboard / passport / me / lab
      for (const [name, url] of [['17-dashboard', '/dashboard'], ['18-me', '/me'], ['19-lab', '/lab?lab=1'], ['20-mentor', '/mentor']]) {
        await p.goto(`${BASE}${url}`, { waitUntil: 'networkidle' }).catch(() => undefined);
        await snap(name, name === '17-dashboard');
      }
    } catch (e) {
      note(`FAIL ${vp.name}: ${e.message}`);
      await p.screenshot({ path: path.join(OUT, `FAIL-${vp.name}.png`), fullPage: true }).catch(() => undefined);
    }

    if (consoleErrors.length) note(`  console errors (${vp.name}): ${[...new Set(consoleErrors)].slice(0, 6).join(' | ')}`);
    await ctx.close();
  }

  await browser.close();
  const bad = results.filter((r) => r.over > 1);
  note(`\noverflowing pages: ${bad.length === 0 ? 'none' : bad.map((b) => `${b.page}@${b.viewport}=${b.over}px`).join(', ')}`);
  note(`screenshots: ${OUT}`);
})().catch((e) => { console.error(e); process.exit(1); });
