#!/usr/bin/env node
/**
 * HALQA — Phase 1 demo recorder (demo/demo-script.md).
 *
 * Two browser contexts, one live backend:
 *   host  — records the video, drives the 10 shots
 *   peer  — joins off-camera with the circle code and posts one peer answer
 *
 * Prerequisites (see halqa-api/README.md + halqa-web/README.md):
 *   halqa-api on :3000  with a real provider configured
 *     PROVIDER_BASE_URL / PROVIDER_API_KEY / COMPACT_MODEL / LARGER_MODEL
 *   halqa-web on :5173  (VITE_API_BASE must point at the API)
 *   npm run seed:demo   in halqa-api (deterministic KB + roster)
 *
 * Usage
 *   cd demo
 *   npm i -D playwright && npx playwright install chromium
 *   node record.cjs                       # 1280x720, 69 s of action
 *   BASE=http://localhost:5173 node record.cjs
 *   HEADED=1 node record.cjs              # watch it run
 *
 * Output
 *   demo/halqa-demo.webm  (video)  ·  demo/halqa-demo.mp4 (if ffmpeg exists)
 *   demo/shots/*.png      (stills for the report figures)
 *
 * The timings mirror the narration table in demo-script.md. Subtitles are
 * injected as a DOM overlay (no ffmpeg burn-in needed) and are removed from
 * the last frame by seeking to 0 before the video is saved.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:5173';
const API = process.env.API || 'http://localhost:3000/api/v1';
const HEADED = !!process.env.HEADED;
const OUT = path.join(__dirname);
const SHOTS = path.join(OUT, 'shots');

/** Narration, exactly the subtitled strings from demo-script.md. */
const CUES = [
  [0, 'HALQA — a peer-first learning companion, in Darija.'],
  [3, 'Learners answer each other first — Nova fills the gaps.'],
  [8, 'A 1-minute passport: context and how you learn.'],
  [12, 'DNA check — level, style, language, confidence.'],
  [16, "Nova now adapts to Rim — not the reverse."],
  [20, 'Rim opens a circle on binary search — in Darija.'],
  [24, 'A join code classmates can open from any phone.'],
  [27, 'Yassine joins from the code — two learners, one circle.'],
  [32, 'Live — a 45-second window for peers first.'],
  [35, "Rim asks: 'Why does binary search need a sorted list?'"],
  [41, 'Yassine answers first — peer knowledge counts.'],
  [44, "Window over → Nova prepares a cited answer, staged."],
  [47, 'In Darija, tier-C, with knowledge-base citations.'],
  [56, 'The Lab: live meters + a chaos console for resilience.'],
  [60, 'Graceful degradation, never blank.'],
  [63, 'The debrief: S-B-U health, shared credits — equity by design.'],
  [67, 'HALQA — built for learners. Merci.'],
];

const shot = (name) => path.join(SHOTS, name);

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });

  // Fail fast with a useful message rather than a blank video.
  const health = await fetch(`${API}/healthz`).catch(() => null);
  if (!health || !health.ok) {
    console.error(`✗ API not reachable at ${API}/healthz — start halqa-api first.`);
    process.exit(1);
  }
  const web = await fetch(BASE).catch(() => null);
  if (!web || !web.ok) {
    console.error(`✗ Web app not reachable at ${BASE} — run "npm run dev" in halqa-web.`);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: !HEADED });

  const hostCtx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: OUT, size: { width: 1280, height: 720 } },
    reducedMotion: 'reduce', // deterministic frames: no spring drift mid-shot
  });
  const peerCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });

  const host = await hostCtx.newPage();
  const peer = await peerCtx.newPage();
  host.on('pageerror', (e) => host.evaluate((m) => { (window.__errs ||= []).push(m); }, e.message).catch(() => {}));
  host.on('console', (m) => {
    if (m.type() === 'error') host.evaluate((t) => { (window.__errs ||= []).push(t); }, m.text()).catch(() => {});
  });

  /** Subtitles + a soft cursor dot, injected once per page. */
  const decorate = async (page) => {
    await page.addInitScript(() => {
      const mount = () => {
        if (document.getElementById('__subs')) return;
        const sub = document.createElement('div');
        sub.id = '__subs';
        Object.assign(sub.style, {
          position: 'fixed', left: '0', right: '0', bottom: '0', zIndex: 2147483000,
          padding: '14px 24px 18px', font: '500 17px/1.35 -apple-system, system-ui, sans-serif',
          color: '#fff', textAlign: 'center', pointerEvents: 'none',
          background: 'linear-gradient(to top, rgba(3,8,12,.82), rgba(3,8,12,0))',
          textShadow: '0 1px 3px rgba(0,0,0,.6)', transition: 'opacity .16s ease',
        });
        document.body.appendChild(sub);

        const dot = document.createElement('div');
        dot.id = '__cursor';
        Object.assign(dot.style, {
          position: 'fixed', width: '18px', height: '18px', borderRadius: '50%',
          zIndex: 2147483001, pointerEvents: 'none', opacity: '0',
          background: 'rgba(30,167,161,.28)', boxShadow: '0 0 0 2px rgba(30,167,161,.75)',
          transform: 'translate(-50%,-50%)', transition: 'opacity .12s ease',
        });
        document.body.appendChild(dot);
        addEventListener('mousemove', (e) => {
          dot.style.opacity = '1';
          dot.style.left = `${e.clientX}px`;
          dot.style.top = `${e.clientY}px`;
        }, { passive: true });
      };
      if (document.readyState === 'loading') addEventListener('DOMContentLoaded', mount);
      else mount();
    });
  };

  const caption = (text) =>
    host.evaluate((t) => {
      const el = document.getElementById('__subs');
      if (el) el.textContent = t;
    }, text);

  const wait = (ms) => host.waitForTimeout(ms);

  /** Marked pauses: every check throws with the shot name, not a bare timeout. */
  const expectVisible = async (page, sel, label) => {
    try {
      await page.waitForSelector(sel, { state: 'visible', timeout: 20000 });
    } catch {
      throw new Error(`[${label}] missing: ${sel}`);
    }
  };

  const steps = [];
  let sessionPath = '';
  const step = async (name, fn) => {
    const t0 = Date.now();
    try {
      await fn();
      steps.push(`PASS ${name} (${Date.now() - t0}ms)`);
      console.log(`PASS ${name} (${Date.now() - t0}ms)`);
    } catch (e) {
      console.log(`FAIL ${name}: ${e.message}`);
      await host.screenshot({ path: shot(`FAIL-${name}.png`) }).catch(() => {});
      throw e;
    }
  };

  try {
    await decorate(host);
    await decorate(peer);

    // ── Shot 1 · Landing ────────────────────────────────────────────────
    await step('shot1-landing', async () => {
      await host.goto(BASE, { waitUntil: 'networkidle' });
      await caption(CUES[0][1]);
      await wait(3200);
      await host.screenshot({ path: shot('01-landing.png') });
      await caption(CUES[1][1]);
      await wait(4200);
    });

    // ── Shot 2 · /enter → /dna ──────────────────────────────────────────
    await step('shot2-enter-dna', async () => {
      // ?next=/dna: guests otherwise land on /board (Enter.tsx routing), and
      // the demo's second beat is the diagnostic.
      await host.goto(`${BASE}/enter?next=/dna`, { waitUntil: 'networkidle' });
      // Guest tab (third of signup | signin | guest): the demo never creates
      // an account — no email, no password, matching the narration.
      await host.locator('.enter-tab').nth(2).click();
      await expectVisible(host, '#nick', 'enter');
      await host.fill('#nick', 'Rim-07');
      await host.locator('input[name="context"][value="study"]').check({ force: true });
      await caption(CUES[2][1]);
      await wait(1400);
      // Assert the auth call itself: a silent 429/500 is the difference
      // between "slow navigation" and "the backend rejected us".
      const authResp = host.waitForResponse((r) => r.url().includes('/auth/'), { timeout: 20000 });
      await host.locator('.enter-submit').click();
      const auth = await authResp;
      if (auth.status() >= 400) {
        throw new Error(`auth/session ${auth.status()}: ${(await auth.text()).slice(0, 180)}`);
      }
      await host
        .waitForFunction(() => location.pathname === '/dna', null, { timeout: 20000 })
        .catch(async (e) => {
          const dump = await host.evaluate(() => ({
            url: location.href,
            body: document.body.innerText.slice(0, 300).replace(/\s+/g, ' '),
            errs: (window.__errs || []).slice(-3),
          }));
          throw new Error(`${e.message} :: ${JSON.stringify(dump)}`);
        });
      await caption(CUES[3][1]);
      await wait(1500);

      // Four taps: one option per fieldset, in DOM order (L1, S1, G1, C1).
      const sets = host.locator('fieldset.dna-step');
      const n = await sets.count();
      for (let i = 0; i < n; i += 1) {
        await sets.nth(i).locator('input[type="radio"]').first().check({ force: true });
        await wait(700);
      }
      await host.screenshot({ path: shot('02-dna.png') });
      await caption(CUES[4][1]);
      await wait(1200);
      await host.locator('form button[type="submit"]').first().click();
      await host.waitForFunction(() => !location.pathname.startsWith('/dna'), null, { timeout: 20000 });
    });

    // ── Shot 3 · Create circle ─────────────────────────────────────────
    await step('shot3-create', async () => {
      await host.goto(`${BASE}/circles/new`, { waitUntil: 'networkidle' });
      await host.locator('input[name="topic"][value="binary_search"]').check({ force: true }).catch(() => {});
      await caption(CUES[5][1]);
      await wait(1600);
      await host.fill('#host', 'Rim');
      await wait(900);
      await host.locator('form button[type="submit"]').click();
      await expectVisible(host, '.code-big, [class*="code"]', 'create-result');
      await caption(CUES[6][1]);
      await wait(3400);
      await host.screenshot({ path: shot('03-circle-code.png') });
    });

    // Reach the lobby, read the code and the ids the peer context needs.
    const lobby = await host.evaluate(async (apiBase) => {
      const token = sessionStorage.getItem('halqa.token') || '';
      const circleId = sessionStorage.getItem('halqa.circle') || '';
      const r = await fetch(`${apiBase}/circles/${circleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { joinCode: (await r.json()).joinCode, circleId, token };
    }, API);

    // ── Shot 4 · Peer joins (off-camera context) ───────────────────────
    await step('shot4-peer-joins', async () => {
      // The peer context is a different browser profile: no token, so
      // RequireAuth would bounce it. Take a guest seat first, then the join
      // screen is reachable with the code prefilled.
      const joinPath = `/circles/join?code=${lobby.joinCode}`;
      await peer.goto(`${BASE}/enter?next=${encodeURIComponent(joinPath)}`, { waitUntil: 'networkidle' });
      await peer.locator('.enter-tab').nth(2).click();
      await expectVisible(peer, '#nick', 'peer-enter');
      await peer.fill('#nick', 'Yassine');
      await peer.locator('.enter-submit').click();
      await peer.waitForFunction(() => /^\/circles\/join/.test(location.pathname), null, { timeout: 20000 });
      await expectVisible(peer, '#jnick', 'peer-join');
      // ?code= already filled the six boxes and fired the preview lookup.
      await peer.fill('#jnick', 'Yassine');
      await peer.locator('form button[type="submit"]').click();
      await peer.waitForFunction(() => /^\/c\//.test(location.pathname), null, { timeout: 20000 });
      await wait(1200);
      // Host refreshes the lobby so "Members 1 → 2" is visible on camera.
      await host.goto(`${BASE}/c/${lobby.circleId}`, { waitUntil: 'networkidle' });
      await caption(CUES[7][1]);
      await wait(4600);
      await host.screenshot({ path: shot('04-lobby.png') });
    });

    // ── Shot 5 · Start the session, ask the question ───────────────────
    await step('shot5-ask', async () => {
      await host.locator('button.btn:not(.btn-ghost)').first().click();
      await host.waitForFunction(() => /^\/c\/[^/]+\/s\//.test(location.pathname), null, { timeout: 25000 });
      sessionPath = new URL(host.url()).pathname;
      await host.waitForSelector('#q', { timeout: 20000 });
      await caption(CUES[8][1]);
      await wait(1400);
      await host.fill('#q', 'علاش الـ binary search تخدم كان على ليستة مرتبة؟');
      await caption(CUES[9][1]);
      await wait(1200);
      await host.locator('form.composer button[type="submit"]').click();
      await expectVisible(host, '.qcard.q-open, .qcard', 'ask');
      await wait(2200);
      await host.screenshot({ path: shot('05-open-window.png') });
    });

    // ── Shot 6 · Peer answers inside the window ────────────────────────
    await step('shot6-peer-answers', async () => {
      await peer.goto(`${BASE}/c/${lobby.circleId}`, { waitUntil: 'networkidle' });
      const startBtn = peer.getByRole('button', { name: /start|rejoindre la session|join/i }).first();
      if (await startBtn.count()) await startBtn.click().catch(() => {});
      await peer.waitForFunction(() => /\/s\//.test(location.pathname), null, { timeout: 20000 }).catch(() => {});
      const box = peer.locator('form.peer-composer input').first();
      if (await box.count()) {
        await box.fill('خاطر التقسيم على زوز يعتمد على الترتيب — كان موش مرتبة ما نعرقوش وين نمشيو.');
        await peer.locator('form.peer-composer button[type="submit"]').click().catch(() => {});
      }
      await caption(CUES[10][1]);
      await wait(3000);
      await host.screenshot({ path: shot('06-peer-answer.png') });
    });

    // ── Shot 7 · Window ends → staged Nova ─────────────────────────────
    await step('shot7-window-ends', async () => {
      await caption(CUES[11][1]);
      // Let the 45 s peer window expire on its own (the honest path), but
      // don't stall the recording if the host configured a longer window.
      const skip = host.getByRole('button', { name: /passer|skip|فوّت/i }).first();
      await host.waitForSelector('.qcard.q-resolved', { timeout: 52000 }).catch(async () => {
        if (await skip.count()) await skip.click().catch(() => {});
        await host.waitForSelector('.qcard.q-resolved', { timeout: 25000 });
      });
      await wait(900);
    });

    // ── Shot 8 · RESOLVED with citations ───────────────────────────────
    await step('shot8-resolved', async () => {
      await expectVisible(host, '.qcard.q-resolved', 'resolved');
      await caption(CUES[12][1]);
      await wait(5000);
      await host.screenshot({ path: shot('08-resolved.png') });

      // The narration claims "tier-C with knowledge-base citations". Three
      // honest outcomes are possible; a silent empty cite list is not one:
      //   1. peers_verified  → the peer's answer won; no model cite is expected
      //   2. cites rendered   → the model answered from the KB
      //   3. labelled degraded → T0/offline tag, or CiteChips' visible warning
      const cites = await host.locator('.cite').count();
      const warn = await host.locator('.cites-warn').count();
      const resolution = await host
        .locator('.qcard.q-resolved .verified, .qcard.q-resolved .ladder, .qcard.q-resolved .poll')
        .count();
      const verifiedByPeer = (await host.locator('.qcard.q-resolved .verified').count()) > 0;
      const tier = (await host.locator('.qcard.q-resolved .tier-chip').first().textContent().catch(() => '')) || '';
      const degraded = /T0|offline|hors ligne|مختصرة/i.test(tier);

      if (cites > 0) {
        steps.push(`INFO citations rendered: ${cites}`);
      } else if (verifiedByPeer) {
        steps.push('INFO resolution=peers_verified — peer answer won, no model cite expected');
      } else if (warn > 0 || degraded) {
        const why = await host.evaluate(async (apiBase) => {
          const r = await fetch(`${apiBase}/degradation`).catch(() => null);
          return r ? await r.json().catch(() => ({})) : {};
        }, API);
        steps.push(`WARN no citations — degraded (${JSON.stringify(why)}) · tier="${tier.trim()}"`);
        console.warn('WARN shot8: answered from the T0 fallback, not the model — check provider quota.');
        console.warn('      Footage is still valid (spec 6.4 degradation is a scored feature), but the');
        console.warn('      "tier C with citations" narration line is not what the screen shows.');
      } else {
        throw new Error(
          `no cites, no visible warning, not degraded (tier="${tier}", resolutionHints=${resolution})`,
        );
      }
    });

    // ── Shot 9 · The Lab, chaos walk ───────────────────────────────────
    await step('shot9-lab', async () => {
      await host.goto(`${BASE}/lab?lab=1`, { waitUntil: 'networkidle' });
      await expectVisible(host, '.lshare, [class*="lshare"], h1', 'lab');
      await caption(CUES[13][1]);
      await wait(3000);
      await host.screenshot({ path: shot('09-lab-metrics.png') });
      await caption(CUES[14][1]);
      for (const mode of ['orange', 'red', 'black', 'green']) {
        const b = host.getByRole('button', { name: new RegExp(mode, 'i') }).first();
        if (await b.count()) await b.click().catch(() => {});
        await wait(900);
        await host.screenshot({ path: shot(`09-chaos-${mode}.png`) });
      }
      await wait(1200);
    });

    // ── Shot 10 · Debrief ──────────────────────────────────────────────
    await step('shot10-debrief', async () => {
      await host.goto(`${BASE}${sessionPath}/debrief`, { waitUntil: 'networkidle' });
      await caption(CUES[15][1]);
      await wait(3600);
      await host.screenshot({ path: shot('10-debrief.png') });
      await caption(CUES[16][1]);
      await wait(1600);
    });
  } catch (e) {
    console.error(`\n✗ Recording aborted: ${e.message}`);
    console.error('  Stills up to the failure are in demo/shots/.');
    console.error(steps.join('\n'));
    await hostCtx.close();
    await peerCtx.close();
    await browser.close();
    process.exit(1);
  }

  // Clear the caption so the final frame is the app, not a subtitle.
  await caption('');
  await wait(400);

  const video = host.video();
  await hostCtx.close(); // flushes the .webm
  await peerCtx.close();
  await browser.close();

  const src = await video.path();
  const dest = path.join(OUT, 'halqa-demo.webm');
  fs.copyFileSync(src, dest);

  // ffmpeg is optional: webm plays in the browser and in the submission form.
  const mp4 = path.join(OUT, 'halqa-demo.mp4');
  const ff = spawnSync('ffmpeg', ['-y', '-i', dest, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '34', mp4], {
    stdio: 'ignore',
  });
  if (ff.status === 0) console.log(`✓ mp4  ${mp4}`);

  const dur = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', dest], {
    encoding: 'utf8',
  });
  const seconds = parseFloat(dur.stdout || '0');
  console.log(`✓ webm ${dest}`);
  if (seconds) {
    console.log(`  duration ${seconds.toFixed(1)}s ${seconds <= 90 ? '(within 90s limit)' : '(OVER 90s — trim)'}`);
  }
  console.log(steps.join('\n'));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
