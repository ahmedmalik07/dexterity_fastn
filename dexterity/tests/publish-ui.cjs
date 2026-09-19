/**
 * Publish module UI check.
 *
 * Launches the real app, opens the Publish page, and drives it against a stubbed
 * HireLoop service so the check needs no network and no API keys.
 *
 *   node tests/publish-ui.cjs
 */

const { _electron: electron } = require('@playwright/test');
const assert = require('node:assert/strict');
const http = require('node:http');

const JOB = {
  jobId: 'junior-react-isb-test',
  job: {
    title: 'Junior React Developer',
    location: 'Islamabad',
    workMode: 'Onsite',
    salaryRange: 'Up to 80,000 PKR',
    summary: 'A junior React role.',
    responsibilities: ['Build UI'],
    mustHaves: ['React', 'JavaScript'],
    niceToHaves: ['TypeScript'],
    jdText: 'Full job description text.',
  },
  variants: {
    linkedin: 'LinkedIn version {{APPLY_LINK}}',
    x: 'X version {{APPLY_LINK}}',
    facebook: 'Facebook version {{APPLY_LINK}}',
    whatsapp: 'WhatsApp version {{APPLY_LINK}}',
    discord: 'Discord version {{APPLY_LINK}}',
  },
};

const PUBLISHED = {
  jobId: JOB.jobId,
  applyBaseUrl: 'http://127.0.0.1:1/apply/' + JOB.jobId,
  variants: JOB.variants,
  channels: [
    { channel: 'linkedin', ok: false, manual: true },
    { channel: 'x', ok: false, manual: true },
    { channel: 'notion', ok: true },
    { channel: 'slack', ok: false, error: 'missing_scope' },
  ],
};

// Stand-in for the HireLoop service.
const server = http.createServer((request, response) => {
  let body = '';
  request.on('data', (chunk) => (body += chunk));
  request.on('end', () => {
    const send = (data) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ ok: true, data }));
    };
    if (request.url === '/api/from-screen') return send({ found: true, oneLiner: 'Junior React dev, Islamabad, onsite, up to 80k', reason: '' });
    if (request.url === '/api/generate') return send(JOB);
    if (request.url === '/api/publish') return send(PUBLISHED);
    response.writeHead(404);
    response.end('{}');
  });
});

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
      if (!page) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(page, 'dashboard window never appeared');

    // The module must be reachable from the sidebar.
    await page.click('[data-page="publish"]');
    await page.waitForSelector('#publish:not([hidden])', { timeout: 5000 });
    console.log('PASS: Publish page opens from the sidebar');

    // Read the role off the screen.
    await app.evaluate(() => {
      // eslint-disable-next-line no-undef
      globalThis.__testCapture = true;
    });
    await page.fill('#one-liner', '');
    await page.click('#write-post');
    await page.waitForSelector('#draft-panel:not([hidden])', { timeout: 5000 }).catch(() => {});

    // Empty input must be refused rather than silently doing nothing.
    const status = await page.textContent('#publish-status');
    assert.match(status, /few more words/, 'empty input was not refused');
    console.log('PASS: empty role is refused with a message');

    // A real one-liner produces the draft and all five platform tabs.
    await page.fill('#one-liner', 'Junior React dev, Islamabad, onsite, up to 80k');
    await page.click('#write-post');
    await page.waitForSelector('#draft-panel:not([hidden])', { timeout: 15000 });

    const title = await page.textContent('#draft-title');
    assert.equal(title, 'Junior React Developer');

    const tabs = await page.$$eval('.platform-tab', (nodes) => nodes.map((n) => n.textContent));
    assert.deepEqual(tabs, ['LinkedIn', 'X', 'Facebook', 'WhatsApp', 'Discord']);

    const variant = await page.inputValue('#variant-text');
    assert.match(variant, /LinkedIn version/);
    console.log('PASS: one line becomes a draft with five platform versions');

    // Publishing reports per-channel outcomes honestly.
    await page.click('#publish-now');
    await page.waitForSelector('#result-panel:not([hidden])', { timeout: 15000 });

    const rows = await page.$$eval('.channel-row', (nodes) =>
      nodes.map((node) => node.textContent.trim()),
    );
    assert.ok(rows.some((row) => /notion/i.test(row) && /published/i.test(row)), 'notion not shown as published');
    assert.ok(rows.some((row) => /linkedin/i.test(row) && /copy and paste/i.test(row)), 'linkedin not shown as manual');
    assert.ok(rows.some((row) => /slack/i.test(row) && /missing_scope/i.test(row)), 'slack failure not surfaced');
    console.log('PASS: publish result names what posted, what is manual, and what failed');

    const copies = await page.$$eval('.copy-button', (nodes) => nodes.map((n) => n.textContent));
    assert.ok(copies.length >= 5, 'expected copy buttons for the channels we could not post');
    console.log('PASS: unposted channels come back ready to paste (' + copies.length + ' buttons)');
  } finally {
    await app.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
