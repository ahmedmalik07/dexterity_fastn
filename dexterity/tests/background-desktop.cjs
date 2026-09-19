// Live UI-to-agent integration; requires an authenticated Codex CLI.
const{_electron:electron}=require('@playwright/test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const env={...process.env,DEXTERITY_TEST:'1'};delete env.ELECTRON_RUN_AS_NODE;
 const desktop=await electron.launch({args:['.'],env});
 try{
  await desktop.firstWindow();let page;for(let attempt=0;attempt<200;attempt++){page=desktop.windows().find(p=>p.url().endsWith('/index.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}assert.ok(page,'Dashboard loaded');await page.waitForFunction(()=>typeof prefs!=='undefined'&&prefs);page.setDefaultTimeout(15000);
  await page.locator('[data-page="background-tasks"]').click();
  await page.locator('#background-goal').fill('Create hello.txt containing exactly Dexterity background agent works. Read it back and verify it. Do nothing else.');
  await page.locator('#background-form button').click();
  await page.locator('.background-card .job-status.done').waitFor({timeout:180000});
  const state=await page.evaluate(()=>api.backgroundJobs());assert.equal(state.jobs[0].status,'done');
  const directory=await desktop.evaluate(({app})=>app.getPath('userData'));
  assert.equal(fs.readFileSync(path.join(directory,'background-tasks',state.jobs[0].id,'hello.txt'),'utf8').trim(),'Dexterity background agent works.');
  await page.getByRole('button',{name:'Preview files',exact:true}).click();await page.locator('#job-file-list button').filter({hasText:'hello.txt'}).click();assert.equal((await page.locator('#job-file-content pre').innerText()).trim(),'Dexterity background agent works.');
  await page.screenshot({path:'test-results/background-file-preview.png'});console.log('PASS: background task UI → live agent → verified output file → in-app file preview.');
 }finally{await desktop.close();}
})().catch(error=>{console.error(error);process.exit(1);});
