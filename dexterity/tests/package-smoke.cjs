const { _electron: electron } = require('@playwright/test');
const path = require('node:path');
(async () => {
 const env = { ...process.env, DEXTERITY_TEST: '1' }; delete env.ELECTRON_RUN_AS_NODE;
 const app = await electron.launch({ executablePath: path.resolve('release-v1.7/win-unpacked/Dexterity.exe'), args: [], env });
 try {
  await app.firstWindow(); let page;
  for (let i = 0; i < 100; i++) { page = app.windows().find(p => p.url().endsWith('/index.html')); if (page) break; await new Promise(r => setTimeout(r, 100)); }
  if (!page) throw new Error('Packaged dashboard did not open.');
  await page.locator('#task-goal').waitFor();
  const prefs = await page.evaluate(() => window.dexterity.settings());
  if (prefs.hasKey) throw new Error('Unexpected key in isolated test profile.');
  const health=await page.evaluate(()=>window.dexterity.nativeHealth());
  if(!health.hooks || !health.recognizers.length)throw new Error('Packaged voice helper unavailable.');
  await page.locator('#forms-nav').click();await page.locator('#inspect-form').waitFor();
  await page.locator('#playbook-nav').click();await page.locator('.playbook-row').first().waitFor();
  await page.locator('[data-page="settings"]').click();await page.locator('#speech-vocabulary').waitFor();await page.locator('#voice-review').waitFor();
  console.log('PASS: packaged dashboard, settings, forms page, playbook, voice settings, Windows hooks and speech helper.');
 } finally { await app.close(); }
})().catch(e => { console.error(e); process.exit(1); });
