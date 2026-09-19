const { _electron: electron } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
 const env = { ...process.env, DEXTERITY_TEST: '1' }; delete env.ELECTRON_RUN_AS_NODE;
 const app = await electron.launch({ args: ['.'], env });
 try {
  await app.firstWindow();
  let page;
  for (let attempt = 0; attempt < 100; attempt++) {
   page = app.windows().find(window => window.url().endsWith('/index.html'));
   if (page) break;
   await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(page, 'Dashboard window opened');
  await page.locator('[data-page="home"]').click();await page.waitForSelector('#start');
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  assert.equal(await page.title(),'Dexterity');
  assert.ok(!(await page.locator('body').innerText()).toLowerCase().includes('notebook'));
  await page.locator('#forms-nav').click();await page.locator('#practice-form').click();
  await page.locator('[data-field-id]').first().waitFor({timeout:30000});
  assert.equal(await page.locator('[data-field-id]').count(),2);
  await page.locator('[data-page="settings"]').click(); await page.locator('#voice').uncheck();
  assert.equal(await page.locator('#model').inputValue(),'gpt-5.4-mini');
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await page.locator('[data-page="guide"]').click(); assert.equal(await page.locator('#empty-screen').isVisible(), true);
  await page.locator('#capture').click(); await page.locator('#screenshot').waitFor({ state: 'visible', timeout: 20000 });
  assert.match(await page.locator('#screenshot').getAttribute('src'), /^data:image/);
  await page.locator('#question').fill('What do I see?'); await page.locator('#ask').click(); await page.locator('#settings').waitFor({ state: 'visible' });
  await page.locator('#api-key').fill('sk-offline-test-key'); await page.getByRole('button', { name: 'Save preferences' }).click();
  const publicPrefs = await page.evaluate(() => window.dexterity.settings()); assert.equal(publicPrefs.hasKey, true); assert.equal(publicPrefs.key, undefined);
  await app.evaluate(() => {
   globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    if (url !== 'https://api.openai.com/v1/responses' || body.store !== false || !body.input[0].content[1].image_url.startsWith('data:image/')) throw new Error('Invalid API request');
    const guide = { summary: 'Offline API fixture', steps: [{ title: 'Visible target', detail: 'This validates the API bridge without network access.', x: .5, y: .5 }] };
    return { ok: true, json: async () => ({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(guide) }] }] }) };
   };
  });
  await page.locator('[data-page="guide"]').click(); await page.locator('#ask').click();
  try { await page.getByText('Offline API fixture').waitFor({timeout:10000}); } catch(e) { console.log(await page.evaluate(()=>({demoSession,busy,prefs,question:$('question').value,toast:$('toast').textContent,summary:$('summary').textContent})));throw e; }
  await page.getByRole('button', { name: 'Show me where' }).click();
  const pointerVisible = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(w => w.webContents.getURL().endsWith('pointer.html') && w.isVisible())); assert.equal(pointerVisible, true);
  await page.evaluate(() => window.dexterity.dismiss());
  await app.evaluate(() => { globalThis.fetch = async () => ({ ok: false, status: 401 }); });
  await page.locator('#ask').click(); await page.getByRole('status').filter({ hasText: 'API key was rejected' }).waitFor();
  await page.locator('[data-page="settings"]').click();await page.locator('#gemini-key').fill('test-backup');await page.getByRole('button',{name:'Save preferences'}).click();
  const backupPrefs=await page.evaluate(()=>window.dexterity.settings());assert.equal(backupPrefs.hasGeminiKey,true);assert.equal(backupPrefs.geminiKey,undefined);
  await app.evaluate(()=>{globalThis.fetch=async url=>url.includes('openai.com')?{ok:false,status:429}:{ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({summary:'Gemini fallback fixture',steps:[]})}]}}]})};});
  await page.locator('[data-page="guide"]').click();await page.locator('#ask').click();await page.getByText('Gemini fallback fixture').waitFor();
  assert.match(await page.locator('#answer-tag').innerText(),/Gemini.*BACKUP/);
  await page.locator('[data-page="history"]').click();assert.equal(await page.locator('.history-item').count(),2);await page.locator('[data-page="guide"]').click();
  await page.locator('#clear').click(); assert.equal(await page.locator('#screenshot').isVisible(), false);
  await page.locator('[data-page="home"]').click(); const companionBefore=await page.locator('#companion').getAttribute('aria-pressed'); await page.locator('#companion').click(); assert.notEqual(await page.locator('#companion').getAttribute('aria-pressed'), companionBefore); await page.locator('#companion').click();
  // Playbook, the voice review step and the cost meter are part of the shipped flow, so they are exercised here.
  await page.locator('#playbook-nav').click(); await page.locator('#playbook').waitFor({ state: 'visible' });
  assert.ok(await page.locator('.playbook-row').count() >= 15, 'playbook lists the everyday phrasings');
  await page.locator('.playbook-row').first().click(); await page.locator('#assistant').waitFor({ state: 'visible' });
  assert.match(await page.locator('#task-goal').inputValue(), /selected word/i);
  assert.equal(await page.locator('input[name="task-mode"][value="answer"]').isChecked(), true);
  await page.evaluate(() => reviewHeard('fill this form with my name', { mode: 'do' }));
  await page.locator('#heard-review').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#voice-heard-text').inputValue(), 'fill this form with my name');
  await page.locator('#voice-heard-text').fill('corrected before it ran');
  assert.match(await page.locator('#voice-heard-count').innerText(), /Countdown stopped/);
  await page.locator('#voice-heard-cancel').click(); assert.equal(await page.locator('#heard-review').isVisible(), false);
  await new Promise(resolve => setTimeout(resolve, 6500));
  assert.equal(await page.locator('#task-result').isVisible(), false, 'a cancelled voice request never starts a task');
  await page.evaluate(() => { $('task-result').hidden = false; renderMeter({ seconds: 4.2, requests: 3, tokens: { input: 2000, output: 300 }, cost: 0.00135, model: 'google/gemini-2.5-flash' }, true); appendLedger({ kind: 'action', pass: true, second: 1.4, message: 'type: Full name = "Alex"' }); appendLedger({ kind: 'check', pass: false, second: 3.9, message: 'Check failed: Email address is still empty.' }); });
  const meter = await page.locator('#task-meter').innerText();
  for (const part of ['4.2s', '3 model requests', '2,300 tokens', '$0.0014', 'gemini-2.5-flash']) assert.ok(meter.includes(part), 'meter shows ' + part);
  assert.equal(await page.locator('#task-log li.ledger-fail').count(), 1);
  await page.locator('[data-page="settings"]').click();
  await page.locator('#speech-vocabulary').fill('IRIS, NADRA, Islamabad'); await page.locator('#voice-review').check();
  await page.getByRole('button', { name: 'Save preferences' }).click();
  const voicePrefs = await page.evaluate(() => window.dexterity.settings());
  assert.equal(voicePrefs.speechVocabulary, 'IRIS, NADRA, Islamabad'); assert.equal(voicePrefs.voiceReview, true);
  await page.locator('#voice-review').uncheck(); await page.getByRole('button', { name: 'Save preferences' }).click();
  assert.equal((await page.evaluate(() => window.dexterity.settings())).voiceReview, false, 'hands-free voice is the default and stays switchable');
  await page.locator('[data-page="home"]').click();
  fs.mkdirSync('test-results', { recursive: true }); await page.evaluate(() => { document.getElementById('toast').hidden = true; window.scrollTo(0, 0); }); await page.screenshot({ path: 'test-results/dashboard.png', fullPage: true });
  assert.deepEqual(errors, []); console.log('PASS: real form demo, history, defaults, capture, OpenAI fixture, Gemini fallback, encrypted key isolation, pointer, clear, companion, playbook, voice review, cost meter, action ledger and renderer.');
 } finally { await app.close(); }
})().catch(e => { console.error(e); process.exit(1); });
