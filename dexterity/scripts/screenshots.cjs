#!/usr/bin/env node
/**
 * Capture documentation screenshots of the desktop companion.
 *
 * Runs the real app against a stubbed HireLoop service, so the Publish module can be
 * shown fully populated without touching anyone's live board.
 *
 *   node scripts/screenshots.cjs
 */

const { _electron: electron } = require('@playwright/test');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');

const OUT = path.resolve(__dirname, '..', '..', 'docs', 'images');
fs.mkdirSync(OUT, { recursive: true });

const JOB = {
  jobId: 'junior-react-isb-7k2',
  job: {
    title: 'Junior React Developer',
    location: 'Islamabad',
    workMode: 'Onsite',
    salaryRange: 'Up to 80,000 PKR',
    summary: 'A junior React role on an in-house product team.',
    responsibilities: ['Build user-facing features in React'],
    mustHaves: ['React', 'JavaScript (ES6+)', 'HTML & CSS'],
    niceToHaves: ['TypeScript'],
    jdText: 'Full job description text.',
  },
  variants: {
    linkedin:
      "We're hiring a Junior React Developer in Islamabad (onsite, up to 80k PKR).\n\nYou'll build real product features in React alongside a small team that reviews every pull request.\n\nWhat we need: React, solid JavaScript, HTML and CSS.\n\nApply here: {{APPLY_LINK}}\n\n#hiring #react #islamabad",
    x: 'Hiring a Junior React Dev in Islamabad. Onsite, up to 80k PKR. React + JS + CSS. Apply: {{APPLY_LINK}} #hiring',
    facebook:
      'Islamabad walon! Humari team mein aik Junior React Developer ki zaroorat hai. Agar aapko React.js, JavaScript aur CSS aata hai, yeh mauqa aapke liye hai. Onsite job, 80k tak. Apply karein: {{APPLY_LINK}}',
    whatsapp:
      'Junior React Developer wanted\nIslamabad (onsite)\nUp to 80,000 PKR\nReact, JavaScript, CSS\nApply: {{APPLY_LINK}}',
    discord:
      "Hey devs, we're looking for a Junior React Developer to join us onsite in Islamabad. React, JS and CSS. Up to 80k PKR. Apply: {{APPLY_LINK}}",
  },
};

const PUBLISHED = {
  jobId: JOB.jobId,
  applyBaseUrl: 'https://hireloop-lilac.vercel.app/apply/' + JOB.jobId,
  variants: JOB.variants,
  channels: [
    { channel: 'linkedin', ok: false, manual: true },
    { channel: 'x', ok: false, manual: true },
    { channel: 'notion', ok: true },
    { channel: 'slack', ok: true },
  ],
};

const server = http.createServer((request, response) => {
  let body = '';
  request.on('data', (chunk) => (body += chunk));
  request.on('end', () => {
    const send = (data) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ ok: true, data }));
    };
    if (request.url === '/api/from-screen')
      return send({ found: true, oneLiner: 'Junior React dev, Islamabad, onsite, up to 80k', reason: '' });
    if (request.url === '/api/generate') return send(JOB);
    if (request.url === '/api/publish') return send(PUBLISHED);
    response.writeHead(404);
    response.end('{}');
  });
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const env = { ...process.env, DEXTERITY_TEST: '1', HIRELOOP_URL: baseUrl, HIRELOOP_JOB: JOB.jobId };
  delete env.ELECTRON_RUN_AS_NODE;

  const app = await electron.launch({ args: ['.'], env });
  try {
    await app.firstWindow();
    let page;
    for (let i = 0; i < 100 && !page; i++) {
      page = app.windows().find((window) => window.url().endsWith('/index.html'));
      if (!page) await sleep(100);
    }
    await page.setViewportSize({ width: 1320, height: 900 });
    await page.waitForFunction(() => typeof prefs !== 'undefined' && prefs);

    const shot = async (name) => {
      await sleep(600);
      await page.screenshot({ path: path.join(OUT, name) });
      console.log('captured', name);
    };

    // 1. The companion home, the app's front door.
    await page.click('[data-page="companion-home"]');
    await shot('dexterity-home.png');

    // 2. The Publish module, empty.
    await page.click('[data-page="publish"]');
    await shot('dexterity-publish-empty.png');

    // 3. Read the role off the screen, then write the post.
    await page.fill('#one-liner', 'Junior React dev, Islamabad, onsite, up to 80k');
    await page.click('#write-post');
    await page.waitForSelector('#draft-panel:not([hidden])', { timeout: 15000 });
    await shot('dexterity-publish-draft.png');

    // 4. A non-default platform tab, to show the per-channel rewrite.
    const tabs = await page.$$('.platform-tab');
    if (tabs[2]) await tabs[2].click();
    await shot('dexterity-publish-facebook.png');

    // 5. Published: what went out, what is ready to paste.
    const first = await page.$$('.platform-tab');
    if (first[0]) await first[0].click();
    await page.click('#publish-now');
    await page.waitForSelector('#result-panel:not([hidden])', { timeout: 15000 });
    await page.evaluate(() => document.getElementById('result-panel').scrollIntoView());
    await shot('dexterity-publish-result.png');

    // 6. Form filling, the capability people ask for by name.
    await page.click('#forms-nav');
    await shot('dexterity-forms.png');

    // 7. The task and teaching surface.
    await page.click('#assistant-nav');
    await shot('dexterity-assistant.png');
  } finally {
    await app.close();
    server.close();
  }
})().catch((error) => {
  console.error('FAILED:', error.message);
  server.close();
  process.exit(1);
});
