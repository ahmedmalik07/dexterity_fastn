/**
 * HireLoop bridge checks.
 * Runs without Electron: the module only needs a data directory and fetch.
 *   node --test tests/hireloop.test.cjs
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const hireloop = require('../electron/hireloop.cjs');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hireloop-test-'));

test('config round trips', () => {
  const saved = hireloop.writeConfig(dir, { baseUrl: 'http://localhost:3000/', jobId: 'junior-react-isb-y89' });
  assert.strictEqual(saved.baseUrl, 'http://localhost:3000');
  assert.strictEqual(saved.jobId, 'junior-react-isb-y89');
});

test('rejects a bad address', () => {
  assert.throws(() => hireloop.writeConfig(dir, { baseUrl: 'notaurl', jobId: 'abc' }), /http/);
});

test('refuses to send without a capture', async () => {
  await assert.rejects(
    hireloop.sendCapture({ userDataDir: dir, image: null, jobId: 'abc' }),
    /Capture the screen/,
  );
});

test('refuses to send without a job', async () => {
  const png = 'data:image/png;base64,' + Buffer.from('x').toString('base64');
  await assert.rejects(
    hireloop.sendCapture({ userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'empty-')), image: png }),
    /job id/,
  );
});

test('describes results in plain language', () => {
  assert.match(
    hireloop.describe({ added: true, emailed: true, capture: { found: true, name: 'Hira Saeed', channel: 'whatsapp' } }),
    /Added Hira Saeed from whatsapp .* emailed/,
  );
  assert.match(hireloop.describe({ capture: { found: false } }), /No candidate/);
  assert.match(
    hireloop.describe({ reason: 'preview', capture: { found: true, name: 'A', channel: 'direct' } }),
    /Nothing has been sent yet/,
  );
});
