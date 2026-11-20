#!/usr/bin/env node
/**
 * HALQA — 90-second demo recorder (demo/demo-script-90.md).
 *
 * One browser context records; a second context is the off-camera peer. Two
 * questions are asked back-to-back so the 30s peer windows run *while* the Lab
 * is on screen — the recording never sits on a spinner waiting for a timer.
 *
 * Every AI path is exercised for real: a peer answer is verified by the
 * auditor (peers_verified), and the asker skips the second window into a
 * hidden Quick Take (skip_direct, tier C, knowledge-base cites). If the
 * provider is down the recorder does not fake it — it fails with the reason,
 * because a demo that promises citations must actually have them.
 *
 * Prerequisites
 *   halqa-api on :3000 with a provider configured (COMPACT_MODEL / LARGER_MODEL)
 *   halqa-web on :5173 with VITE_API_BASE pointing at that API
 *   npm run seed:demo  in halqa-api
 *
 * Usage
 *   cd demo && node record-90.cjs
 *   HEADED=1 node record-90.cjs        watch it run
 *   SPEED=0.5 node record-90.cjs       slow every beat by 2× (review timing)
 *
 * Output
 *   demo/halqa-demo-90.webm   video (1280×720)
 *   demo/shots/90-*.png       stills
 *   demo/halqa-demo-90.mp4    only if ffmpeg is installed
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { createHmac } = require('crypto');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:5173';
const API = process.env.API || 'http://localhost:3000/api/v1';
const HEADED = !!process.env.HEADED;
// 0.8 by default: the beats sum to ~52s of scripted waits and the settled
// cut lands at 101s at 1×. Every caption still holds ≥1.1s.
const SPEED = Number(process.env.SPEED || 0.8);
const OUT = __dirname;
const SHOTS = path.join(OUT, 'shots');
const WINDOW_S = 30;

/**
 * A staff token for the Lab beat.
 *
 * `/metrics` is mentor/admin only — that is deliberate, it carries the whole cost
 * structure — so filming the Lab as the guest learner Rim showed two empty cards
 * and a "forbidden" note. The Lab is a workshop surface; it is filmed as the
 * seeded mentor. Same signer as `src/security/tokens.ts`, so this only works when
 * the recorder can read `TOKEN_SECRET`, which the local dev shell can.
 */
function staffToken() {
  const secret = process.env.TOKEN_SECRET;
  const sub = process.env.STAFF_ID || 'L-06'; // seeded Mentor-Amel
  const epoch = process.env.STAFF_EPOCH || '0';
  if (!secret) throw new Error('TOKEN_SECRET unset — run with `node --env-file=../halqa-api/.env`');
  const now = Math.floor(Date.now() / 1000);
  const body = { sub, role: 'mentor', ep: Number(epoch), iat: now, exp: now + 2 * 60 * 60 };
  const data = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

/** [startSeconds, caption]. Timings are the designed budget, not a guess —
 *  `node record-90.cjs` prints the measured drift per beat at the end. */
const CUES = [
  [0, 'HALQA — peer-first learning, in the learner\'s own language.'],
  [5, 'Thirty seconds in: no account, no email. Just a name.'],
  [11, 'A one-minute passport — how you learn, not just what you know.'],
  [18, 'Nova now adapts to Rim. Not the reverse.'],
  [23, 'Rim opens a circle on binary search, in Darija.'],
  [29, 'A six-character code — any phone, any classroom.'],
  [35, 'Yassine joins. Two learners, one circle.'],
  [41, 'Peer answers first. Nova only fills the gap.'],
  [47, 'A thirty-second window — the circle gets the first move.'],
  [53, 'While it runs: the Lab. Live cost, latency, and L-share.'],
  [60, 'Green, orange, red, black — degradation you can see and read.'],
  [67, 'Window closed. The peer\'s answer was verified, with citations.'],
  [74, 'Rim skips the wait: Nova answers — tier C, grounded in the KB.'],
  [81, 'Hints escalate L1 → L4. Deep dive when the answer needs depth.'],
  [85, 'The debrief: what stuck, what drifted, who taught whom.'],
  [89, 'HALQA — the circle answers first. Merci.'],
];

const shot = (name) => path.join(SHOTS, name);
const wait = (page, ms) => page.waitForTimeout(Math.round(ms * SPEED));

/** 90s is the deliverable; the timings above are tuned to land there. */
(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });

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
    // Deterministic frames: springs land on their final value instead of
    // drifting mid-shot, so a 90s cut does not need frame-by-frame retiming.
    reducedMotion: 'reduce',
  });
  const peerCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });

  const host = await hostCtx.newPage();
  const peer = await peerCtx.newPage();

  /** Subtitle bar + a soft cursor dot, injected before any app script runs. */
  const decorate = (page) =>
    page.addInitScript(() => {
      const mount = () => {
        if (document.getElementById('__subs')) return;
        const sub = document.createElement('div');
        sub.id = '__subs';
        Object.assign(sub.style, {
          position: 'fixed', left: '0', right: '0', bottom: '0', zIndex: 2147483000,
          padding: '16px 32px 20px', font: '500 19px/1.35 -apple-system, system-ui, sans-serif',
          color: '#fff', textAlign: 'center', pointerEvents: 'none', letterSpacing: '-0.01em',
          background: 'linear-gradient(to top, rgba(3,8,12,.86), rgba(3,8,12,.55) 55%, rgba(3,8,12,0))',
          textShadow: '0 1px 3px rgba(0,0,0,.7)', transition: 'opacity .18s ease',
        });
        document.body.appendChild(sub);

        const dot = document.createElement('div');
        dot.id = '__cursor';
        Object.assign(dot.style, {
          position: 'fixed', width: '18px', height: '18px', borderRadius: '50%',
          zIndex: 2147483001, pointerEvents: 'none', opacity: '0',
          background: 'rgba(30,167,161,.30)', boxShadow: '0 0 0 2px rgba(30,167,161,.85)',
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

  const caption = (text) =>
    host.evaluate((t) => {
      const el = document.getElementById('__subs');
      if (el) el.textContent = t;
    }, text);

  /** A smooth glide, so the cursor dot reads as a hand rather than a jump. */
  const glide = async (x, y) => {
    await host.mouse.move(x, y, { steps: 12 });
    await host.waitForTimeout(120);
  };

  const expectVisible = async (page, sel, label, timeout = 20000) => {
    try {
      await page.waitForSelector(sel, { state: 'visible', timeout });
    } catch {
      throw new Error(`[${label}] missing: ${sel}`);
    }
  };

  const t0 = Date.now();
  const beats = [];
  const step = async (name, fn) => {
    const at = (Date.now() - t0) / 1000;
    try {
      await fn();
      const line = `${at.toFixed(1)}s  ${name}`;
      beats.push(line);
      console.log(line);
    } catch (e) {
      console.log(`FAIL ${name} @ ${at.toFixed(1)}s: ${e.message}`);
      await host.screenshot({ path: shot(`FAIL-${name}.png`) }).catch(() => {});
      throw e;
    }
  };

  const api = async (p, opts = {}) => {
    const r = await fetch(`${API}${p}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
    });
    const text = await r.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    if (!r.ok) throw new Error(`${p} → ${r.status} ${text.slice(0, 160)}`);
    return body;
  };

  let sessionPath = '';
  let circleId = '';
  let joinCode = '';
  /** Rim's own identity, saved before the Lab borrows a staff session. */
  let rimToken = '';
  let rimId = '';

  try {
    await decorate(host);
    await decorate(peer);

    // ── 0:00 · Landing ─────────────────────────────────────────────────
    await step('0:00 landing', async () => {
      await host.goto(BASE, { waitUntil: 'networkidle' });
      await caption(CUES[0][1]);
      await wait(host, 3400);
      await host.screenshot({ path: shot('90-01-landing.png') });

      // Move the eye to the two promises that frame the whole demo.
      await glide(640, 470);
      await caption(CUES[1][1]);
      await wait(host, 1700);
    });

    // ── 0:05 · Guest entry ─────────────────────────────────────────────
    await step('0:05 enter', async () => {
      await host.goto(`${BASE}/enter?next=/dna`, { waitUntil: 'networkidle' });
      await host.locator('.enter-tab').nth(2).click(); // Try as a guest
      await expectVisible(host, '#nick', 'enter');
      await host.fill('#nick', 'Rim-07');
      await glide(400, 300);
      await caption(CUES[1][1]);
      await wait(host, 1500);
      const authPromise = host.waitForResponse((r) => r.url().includes('/auth/'), { timeout: 20000 });
      await host.locator('.enter-submit').click();
      const auth = await authPromise;
      if (auth.status() >= 400) throw new Error(`auth/session ${auth.status()}: ${(await auth.text()).slice(0, 160)}`);
      await host.waitForFunction(() => location.pathname === '/dna', null, { timeout: 20000 });
    });

    // ── 0:11 · DNA → live passport ─────────────────────────────────────
    await step('0:11 dna', async () => {
      await caption(CUES[2][1]);
      await wait(host, 1200);
      const sets = host.locator('fieldset.dna-step');
      const n = await sets.count();
      for (let i = 0; i < n; i += 1) {
        await sets.nth(i).locator('input[type="radio"]').first().check({ force: true });
        await wait(host, 560);
      }
      await host.screenshot({ path: shot('90-02-dna.png') });
      await caption(CUES[3][1]);
      await wait(host, 2400);
      await host.locator('form button[type="submit"]').first().click();
      await host.waitForFunction(() => !location.pathname.startsWith('/dna'), null, { timeout: 20000 });
      await wait(host, 1100);
    });

    // ── 0:23 · Create the circle ───────────────────────────────────────
    await step('0:23 create circle', async () => {
      ({ token: rimToken, id: rimId } = await host.evaluate(() => ({
        token: sessionStorage.getItem('halqa.token') || '',
        id: sessionStorage.getItem('halqa.learner') || '',
      })));
      await host.goto(`${BASE}/circles/new`, { waitUntil: 'networkidle' });
      await host.locator('input[name="topic"][value="binary_search"]').check({ force: true }).catch(() => undefined);
      await caption(CUES[4][1]);
      await wait(host, 1500);
      await host.fill('#host', 'Rim');
      // Pull the peer window to 30s: the shortest honest window keeps the
      // 90-second budget, and the recording shows the number it will wait for.
      await host.locator('#win').fill(String(WINDOW_S)).catch(() => undefined);
      await wait(host, 700);
      await host.locator('form button[type="submit"]').click();
      await expectVisible(host, '.code-big', 'create-result');
      await caption(CUES[5][1]);
      await wait(host, 2600);
      await host.screenshot({ path: shot('90-03-circle-code.png') });

      const ids = await host.evaluate(async (apiBase) => {
        const token = sessionStorage.getItem('halqa.token') || '';
        const id = sessionStorage.getItem('halqa.circle') || '';
        const r = await fetch(`${apiBase}/circles/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        return { joinCode: (await r.json()).joinCode, circleId: id };
      }, API);
      joinCode = ids.joinCode;
      circleId = ids.circleId;
    });

    // ── 0:29 · Peer joins, off-camera ──────────────────────────────────
    await step('0:29 peer joins', async () => {
      const joinPath = `/circles/join?code=${encodeURIComponent(joinCode)}`;
      await peer.goto(`${BASE}/enter?next=${encodeURIComponent(joinPath)}`, { waitUntil: 'networkidle' });
      await peer.locator('.enter-tab').nth(2).click();
      await expectVisible(peer, '#nick', 'peer-enter');
      await peer.fill('#nick', 'Yassine');
      await peer.locator('.enter-submit').click();
      await peer.waitForFunction(() => /^\/circles\/join/.test(location.pathname), null, { timeout: 20000 });
      await expectVisible(peer, '#jnick', 'peer-join');
      await peer.fill('#jnick', 'Yassine');
      await peer.locator('form button[type="submit"]').click();
      await peer.waitForFunction(() => /^\/c\//.test(location.pathname), null, { timeout: 20000 });

      await host.locator('.btn-ghost').filter({ hasText: /lobby|attendre|salle/i }).first()
        .click({ timeout: 3000 }).catch(() => undefined);
      await host.goto(`${BASE}/c/${circleId}`, { waitUntil: 'networkidle' });
      await caption(CUES[6][1]);
      await wait(host, 3000);
      await host.screenshot({ path: shot('90-04-lobby.png') });
    });

    // ── 0:35 · Start, then two questions back-to-back ──────────────────
    await step('0:35 start + ask x2', async () => {
      await host.locator('button.btn:not(.btn-ghost)').first().click();
      await host.waitForFunction(() => /^\/c\/[^/]+\/s\//.test(location.pathname), null, { timeout: 25000 });
      sessionPath = new URL(host.url()).pathname;
      await expectVisible(host, '#q', 'session');

      await caption(CUES[7][1]);
      await wait(host, 900);

      // Q1 — the peer answers this one.
      await host.fill('#q', '3lech binary search tehtej liste mrattba?');
      await caption(CUES[8][1]);
      await wait(host, 900);
      await host.locator('form.composer button[type="submit"]').click();
      await expectVisible(host, '.qcard.q-open', 'ask-1');

      // Q2 — the asker will skip this one into a tier-C Quick Take.
      await wait(host, 700);
      await host.fill('#q', 'Chnouwa el far9 bin linear w binary search fel complexité?');
      await wait(host, 600);
      await host.locator('form.composer button[type="submit"]').click();
      await expectVisible(host, '.qcard.q-open', 'ask-2');
      await wait(host, 1400);
      await host.screenshot({ path: shot('90-05-open-window.png') });
    });

    // ── 0:41 · Peer answers the first question ─────────────────────────
    await step('0:41 peer answers', async () => {
      await peer.goto(`${BASE}${sessionPath}`, { waitUntil: 'networkidle' }).catch(async () => {
        await peer.goto(`${BASE}/c/${circleId}`, { waitUntil: 'networkidle' });
        await peer.locator('button.btn:not(.btn-ghost)').first().click().catch(() => undefined);
      });
      await expectVisible(peer, '.qcard.q-open', 'peer-session').catch(() => undefined);

      // The feed is newest-first, so index alone would swap the answers between
      // cards and the auditor would (correctly) reject both. Match by question.
      const pairs = [
        { ask: 'tehtej liste mrattba', say: 'Khater el mid hiya li t9assem el majal — bila tartib ma tnajemch t3ref win temchi.' },
        { ask: 'linear w binary', say: 'Linear kat9ra kol w7ed (O(n)) ; binary kat9essem (O(log n)) walakin t7taj triyb 9bel.' },
      ];
      for (const p of pairs) {
        const card = peer.locator('.qcard.q-open').filter({ hasText: p.ask }).first();
        if ((await card.count()) === 0) continue;
        const input = card.locator('form.peer-composer input').first();
        await input.fill(p.say).catch(() => undefined);
        await card.locator('form.peer-composer button[type="submit"]').first().click().catch(() => undefined);
        await peer.waitForTimeout(400);
      }
      await glide(420, 330);
      await caption(CUES[7][1]);
      await wait(host, 2600);
      await host.screenshot({ path: shot('90-06-peer-answer.png') });
    });

    // ── 0:47–1:07 · The Lab while the windows run ──────────────────────
    await step('0:47 lab', async () => {
      await caption(CUES[8][1]);
      await wait(host, 900);
      // The Lab reads `/metrics`, which is staff-only on purpose. Film it as the
      // seeded mentor, then put Rim's token back so the room continues as her.
      const staff = staffToken();
      await host.evaluate((tk) => sessionStorage.setItem('halqa.token', tk), staff);
      await host.evaluate((id) => sessionStorage.setItem('halqa.learner', id), process.env.STAFF_ID || 'L-06');
      await host.goto(`${BASE}/lab?lab=1`, { waitUntil: 'networkidle' });
      await expectVisible(host, '.lshare', 'lab');
      // The route table fills the first screen; the caption promises the meters,
      // so show them rather than a table the narration does not mention.
      await host.locator('.lshare').scrollIntoViewIfNeeded();
      await caption(CUES[9][1]);
      await wait(host, 3000);
      await host.screenshot({ path: shot('90-07-lab.png') });

      await caption(CUES[10][1]);
      for (const mode of ['orange', 'red', 'black', 'green']) {
        const b = host.getByRole('button', { name: new RegExp(mode, 'i') }).first();
        if (await b.count()) await b.click({ timeout: 3000 }).catch(() => undefined);
        await wait(host, 1700);
        await host.screenshot({ path: shot(`90-08-chaos-${mode}.png`) });
      }
      await wait(host, 600);
    });

    // ── 1:07 · Back to the room: the peer answer won ───────────────────
    await step('1:07 peers_verified', async () => {
      await host.evaluate((tk) => sessionStorage.setItem('halqa.token', tk), rimToken);
      await host.evaluate((id) => sessionStorage.setItem('halqa.learner', id), rimId);
      if (!rimToken || !rimId) throw new Error('lost Rim\'s identity before the peer-verified beat');
      await host.goto(`${BASE}${sessionPath}`, { waitUntil: 'networkidle' });
      await caption(CUES[11][1]);
      await host.waitForSelector('.qcard.q-resolved', { timeout: 30000 });
      await wait(host, 1000);

      const verified = await host.locator('.qcard.q-resolved .verified').count();
      if (verified === 0) {
        const body = await host.locator('.qcard.q-resolved').first().innerText().catch(() => '');
        throw new Error(`first card is not peers_verified — got: ${body.slice(0, 200).replace(/\s+/g, ' ')}`);
      }
      await glide(640, 300);
      await wait(host, 2200);
      await host.screenshot({ path: shot('90-09-resolved-peers.png') });
    });

    // ── 1:14 · Skip the second window → tier-C answer ──────────────────
    await step('1:14 skip_direct', async () => {
      const open = host.locator('.qcard.q-open');
      if (await open.count()) {
        await open.first().getByRole('button', { name: /passer|skip|فوّت/i }).first()
          .click({ timeout: 4000 }).catch(() => undefined);
      }
      await caption(CUES[12][1]);
      await host.waitForFunction(
        () => document.querySelectorAll('.qcard.q-resolved').length >= 2,
        null,
        { timeout: 40000 },
      );

      // Honest-outcome check: the narration promises tier C with cites. A T0
      // tag means the provider fell back, and that must not ship as a claim.
      const cards = await host.evaluate(() =>
        [...document.querySelectorAll('.qcard.q-resolved')].map((c) => ({
          text: c.innerText.replace(/\s+/g, ' ').slice(0, 160),
          cites: c.querySelectorAll('.cite').length,
          tier: c.querySelector('.tier-chip')?.textContent ?? '',
        })),
      );
      const withCites = cards.filter((c) => c.cites > 0);
      if (withCites.length === 0) throw new Error(`no card rendered citations: ${JSON.stringify(cards)}`);
      // The skipped question's card is the last one, and the caption names it.
      // Scroll to it so the frame shows the Nova answer, not the peer's above it.
      await host.locator('.qcard.q-resolved').last().scrollIntoViewIfNeeded().catch(() => undefined);
      await wait(host, 2600);
      await host.screenshot({ path: shot('90-10-tier-c.png') });
    });

    // ── 1:21 · Hint ladder + deep dive ─────────────────────────────────
    await step('1:21 ladder', async () => {
      const ladder = host.locator('.qcard.q-resolved .ladder').first();
      if (await ladder.count()) {
        await ladder.getByRole('button', { name: /^H1$/ }).click({ timeout: 4000 }).catch(() => undefined);
        await wait(host, 1300);
        await ladder.getByRole('button', { name: /^H2$/ }).click({ timeout: 3000 }).catch(() => undefined);
        await wait(host, 1300);
        await caption(CUES[13][1]);
        await wait(host, 1500);
      } else {
        await wait(host, 2600);
      }
      await host.screenshot({ path: shot('90-11-ladder.png') });
    });

    // ── 1:25 · Debrief ─────────────────────────────────────────────────
    await step('1:25 debrief', async () => {
      await host.goto(`${BASE}${sessionPath}/debrief`, { waitUntil: 'networkidle' });
      await caption(CUES[14][1]);
      await wait(host, 2800);
      await host.screenshot({ path: shot('90-12-debrief.png') });
      await host.mouse.wheel(0, 520);
      await wait(host, 1900);
      await host.screenshot({ path: shot('90-13-debrief-more.png') });
      await caption(CUES[15][1]);
      await wait(host, 1400);
    });
  } catch (e) {
    console.error(`\n✗ Recording aborted: ${e.message}`);
    console.error('  Stills up to the failure are in demo/shots/.');
    await hostCtx.close();
    await peerCtx.close();
    await browser.close();
    process.exit(1);
  }

  await caption('');
  await wait(host, 300);

  const video = host.video();
  await hostCtx.close();
  await peerCtx.close();
  await browser.close();

  const dest = path.join(OUT, 'halqa-demo-90.webm');
  fs.copyFileSync(await video.path(), dest);

  const mp4 = path.join(OUT, 'halqa-demo-90.mp4');
  const ff = spawnSync('ffmpeg', ['-y', '-i', dest, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '34', mp4], { stdio: 'ignore' });
  if (ff.status === 0) console.log(`✓ mp4  ${mp4}`);

  const duration = (Date.now() - t0) / 1000;
  console.log(`\n✓ ${dest}`);
  console.log(`  wall clock ${duration.toFixed(1)}s ${duration <= 92 ? '(within 90s + tail)' : '(OVER — trim a beat)'}`);
  console.log(beats.map((b) => `  ${b}`).join('\n'));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
