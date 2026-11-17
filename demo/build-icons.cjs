/**
 * Rasterize the HALQA mark into the PWA / platform icon set.
 * Runs through the demo Playwright install (no sharp/imagemagick here).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const WEB = path.resolve(__dirname, '../halqa-web');
const SYMBOL = path.join(WEB, 'public/brand/halqa-symbol.svg');

const svg = fs.readFileSync(SYMBOL, 'utf8')
  // the mark occupies x[296..1642] y[324..1587] of the 1920 box; crop to that
  // square so the icon reads at full size instead of floating in padding
  .replace('viewBox="0 0 1920 1920"', 'viewBox="296 282 1346 1346"');

const targets = [
  { file: 'icon-192.png', size: 192, pad: 0.16, bg: '#ffffff' },
  { file: 'icon-512.png', size: 512, pad: 0.16, bg: '#ffffff' },
  { file: 'apple-touch-icon.png', size: 180, pad: 0.18, bg: '#ffffff' },
  { file: 'icon-maskable-512.png', size: 512, pad: 0.28, bg: '#ffffff' },
];

(async () => {
  const browser = await chromium.launch();
  for (const t of targets) {
    const page = await browser.newPage({
      viewport: { width: t.size, height: t.size },
      deviceScaleFactor: 1,
    });
    const inner = Math.round(t.size * (1 - t.pad * 2));
    await page.setContent(`<!doctype html><html><body style="margin:0;width:${t.size}px;height:${t.size}px;
      background:${t.bg};display:grid;place-items:center">
      <div style="width:${inner}px;height:${inner}px">${svg}</div>
      </body></html>`);
    await page.waitForTimeout(150);
    const out = path.join(WEB, 'public', t.file);
    await page.screenshot({ path: out, omitBackground: false });
    await page.close();
    console.log(`${t.file.padEnd(26)} ${t.size}px  ${(fs.statSync(out).size / 1024).toFixed(1)} KB`);
  }
  await browser.close();
})();
