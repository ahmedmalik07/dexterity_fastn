/**
 * Browser form filling, end to end, against a real Chrome window.
 *
 * Proves the capability people actually ask for: "fill this Google Form for me".
 * A local page stands in for the real thing so nothing is submitted to anyone else's
 * form, and the local server asserts the submitted values really arrived.
 *
 * This deliberately does NOT use form:browser, which drives the address bar with
 * synthetic keystrokes; the test opens the page itself and exercises the part that
 * matters — reading, filling and submitting fields through UI Automation.
 *
 *   node tests/browser-form.cjs
 */

const { _electron: electron } = require('@playwright/test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn, execSync } = require('node:child_process');

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Dexterity browser form test</title>
<style>body{font-family:Segoe UI,sans-serif;max-width:520px;margin:40px auto}label{display:block;margin:18px 0 6px;font-weight:600}
input{width:100%;padding:10px;font-size:16px;border:1px solid #ccc;border-radius:6px}button{margin-top:22px;padding:10px 20px;font-size:16px}</style></head>
<body><h1>Job application</h1><form method="POST" action="/submit">
<label for="fullname">Full name</label><input id="fullname" name="fullname" type="text" autocomplete="off">
<label for="email">Email address</label><input id="email" name="email" type="email" autocomplete="off">
<label for="phone">Phone number</label><input id="phone" name="phone" type="text" autocomplete="off">
<label for="secret">Password</label><input id="secret" name="secret" type="password" autocomplete="off">
<button type="submit">Submit</button></form></body></html>`;

let received = null;

const server = http.createServer((request, response) => {
  if (request.method === 'POST' && request.url === '/submit') {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      received = Object.fromEntries(new URLSearchParams(body));
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<h1>Received</h1>');
    });
    return;
  }
  response.writeHead(200, { 'content-type': 'text/html' });
  response.end(PAGE);
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/form`;

  // Open the page in a real Chrome window of its own.
  const CHROME = String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
  const chrome = spawn(CHROME, ['--new-window', '--no-first-run', '--no-default-browser-check', url], {
    stdio: 'ignore',
    detached: true,
  });
  chrome.unref();
  await sleep(9000);

  const env = { ...process.env, DEXTERITY_TEST: '1' };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ['.'], env });

  try {
    await app.firstWindow();
    let page;
    for (let i = 0; i < 100 && !page; i++) {
      page = app.windows().find((window) => window.url().endsWith('/index.html'));
      if (!page) await sleep(100);
    }

    await page.locator('#forms-nav').waitFor({ timeout: 15000 });
    await page.locator('#forms-nav').click();

    // Find the Chrome window showing our page.
    await page.locator('#refresh-windows').click();
    await sleep(1500);

    const windows = await page.$$eval('#form-window option', (options) =>
      options.map((option) => ({ value: option.value, label: option.textContent })),
    );
    const target = windows.find((option) => /Dexterity browser form test/i.test(option.label));
    assert.ok(target, 'Chrome window not listed. Windows seen: ' + JSON.stringify(windows));
    console.log('PASS: the browser window is visible to Dexterity — ' + target.label.trim());

    await page.selectOption('#form-window', target.value);
    await page.locator('#inspect-form').click();
    await page.locator('[data-field-id]').first().waitFor({ timeout: 30000 });

    const snapshot = await page.evaluate(() => ({
      title: formSnapshot.title,
      labels: formSnapshot.fields.map((field) => field.label),
    }));
    console.log('PASS: read the form — ' + JSON.stringify(snapshot.labels));

    assert.ok(
      !snapshot.labels.some((label) => /password/i.test(label)),
      'password field must never be offered for filling',
    );
    console.log('PASS: the password field was excluded');

    // Fill as the person, then submit.
    const values = {
      'Full name': 'Ahmed Malik',
      'Email address': 'ahmed@example.test',
      'Phone number': '+92 300 1234567',
    };
    for (const [label, value] of Object.entries(values)) {
      const field = page.getByLabel(label, { exact: true });
      const found = await field.count();
      console.log(`   field "${label}": ${found ? 'filling' : 'NOT FOUND'}`);
      if (found) await field.fill(value);
    }

    // Typing values is not submitting: the app writes them into the page only when asked.
    assert.equal(await page.locator('#submit-form').isDisabled(), true, 'submit must be gated');
    await page.locator('#fill-fields').click();
    await page.getByText(/Filled \d+ fields?\. Nothing submitted yet\./).waitFor({ timeout: 30000 });
    assert.equal(received, null, 'filling must never submit on its own');
    console.log('PASS: filled the real page in Chrome, and nothing was submitted yet');

    // Submitting needs an explicit button choice and a ticked confirmation.
    const buttons = await page.$$eval('#submit-button option', (options) =>
      options.map((option) => option.textContent.trim()).filter(Boolean),
    );
    console.log('   submit buttons found: ' + JSON.stringify(buttons));
    await page.selectOption('#submit-button', { index: 1 });
    await page.locator('#review-confirm').check();
    await page.locator('#submit-form').click();

    for (let i = 0; i < 80 && !received; i++) await sleep(250);
    assert.ok(received, 'the form was never submitted to the server');
    assert.equal(received.fullname, values['Full name']);
    assert.equal(received.email, values['Email address']);
    console.log('PASS: the browser form was submitted — server received ' + JSON.stringify(received));
  } finally {
    await app.close();
    server.close();
    try {
      execSync('taskkill /f /im chrome.exe /fi "WINDOWTITLE eq Dexterity browser form test*"', { stdio: 'ignore' });
    } catch {
      /* the window may already be gone */
    }
  }
})().catch((error) => {
  console.error('FAILED:', error.message);
  server.close();
  process.exit(1);
});
