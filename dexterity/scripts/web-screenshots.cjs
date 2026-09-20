#!/usr/bin/env node
/**
 * Capture documentation screenshots of the live HireLoop web app.
 *
 * Drives the real deployment in a real Chrome, so every screenshot shows the product
 * a judge would actually see, including a genuine publish with its QR code.
 *
 *   node scripts/web-screenshots.cjs [baseUrl]
 */

const { chromium } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs');

const BASE = process.argv[2] || 'https://hireloop-lilac.vercel.app';
const OUT = path.resolve(__dirname, '..', '..', 'docs', 'images');
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const desktop = await browser.newContext({ viewport: { width: 1360, height: 950 } });
  const page = await desktop.newPage();

  const shot = async (name, options = {}) => {
    await sleep(700);
    await page.screenshot({ path: path.join(OUT, name), ...options });
    console.log('captured', name);
  };

  // 1. Landing.
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await shot('web-landing.png');

  // 2. Compose, before anything is typed.
  await page.goto(`${BASE}/compose`, { waitUntil: 'networkidle' });
  await shot('web-compose-empty.png');

  // 3. One line becomes a job post and five platform versions.
  await page.fill('input.field', 'Junior React dev, Islamabad, onsite, up to 80k');
  await page.click('button:has-text("Generate")');
  await page.waitForSelector('text=Step two', { timeout: 90000 });
  await shot('web-compose-generated.png', { fullPage: true });

  // 4. Publish: the channel report and the QR a judge scans.
  await page.click('button:has-text("Publish")');
  await page.waitForSelector('text=Step four', { timeout: 90000 });
  // The QR is generated server-side and loads after the panel renders; without this
  // wait the screenshot catches an empty placeholder where the demo's centrepiece goes.
  await page.waitForFunction(
    () => {
      const img = document.querySelector('img[alt*="QR"]');
      return img && img.complete && img.naturalWidth > 0;
    },
    null,
    { timeout: 30000 },
  );
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await shot('web-publish-result.png', { fullPage: true });

  const applyUrl = await page.evaluate(() => {
    const link = [...document.querySelectorAll('a')].find((a) => /\/apply\//.test(a.href));
    return link ? link.href : null;
  });
  const jobId = applyUrl ? applyUrl.split('/apply/')[1].split('?')[0] : null;
  console.log('published job:', jobId);

  // 5. The applicant's view, on a phone.
  if (applyUrl) {
    const phone = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const mobile = await phone.newPage();
    await mobile.goto(applyUrl, { waitUntil: 'networkidle' });
    await sleep(900);
    await mobile.screenshot({ path: path.join(OUT, 'web-apply-mobile.png'), fullPage: true });
    console.log('captured web-apply-mobile.png');
    await phone.close();
  }

  // 6. Channel performance, with the live stage watcher.
  await page.goto(`${BASE}/stats/junior-react-isb-k2z`, { waitUntil: 'networkidle' });
  await shot('web-stats.png', { fullPage: true });

  // 7. The screen-capture route for channels that have no API.
  await page.goto(`${BASE}/capture`, { waitUntil: 'networkidle' });
  await shot('web-capture.png');

  await browser.close();
  if (jobId) fs.writeFileSync(path.join(OUT, '.last-job'), jobId);
})().catch((error) => {
  console.error('FAILED:', error.message);
  process.exit(1);
});
