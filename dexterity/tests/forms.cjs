const { _electron: electron }=require('@playwright/test');
const assert=require('node:assert/strict');
const { spawn }=require('node:child_process');
const path=require('node:path');
const fs=require('node:fs');
(async()=>{
 const env={...process.env,DEXTERITY_TEST:'1'};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch({args:['.'],env});let form;
 try{
  await app.firstWindow();let page;
  for(let i=0;i<100;i++){page=app.windows().find(p=>p.url().endsWith('/index.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}
  await page.locator('#forms-nav').waitFor();
  const health=await page.evaluate(()=>window.dexterity.nativeHealth());assert.equal(health.hooks,true);assert.ok(health.recognizers.includes('en-US'));
  console.log('PASS: Windows global hooks and offline recognizer available.');
  form=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','RemoteSigned','-File',path.resolve('native/Start-Dexterity.ps1'),'-TestForm'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let submitted=0;form.stdout.on('data',data=>{if(data.toString().includes('SUBMITTED'))submitted++;});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Practice form startup timed out')),25000);form.stdout.on('data',data=>{if(data.toString().includes('FORM_READY')){clearTimeout(timer);resolve();}});form.stderr.on('data',data=>console.log('Practice startup:',data.toString()));form.once('exit',code=>{clearTimeout(timer);reject(new Error('Practice form exited '+code));});});
  await page.locator('#forms-nav').click();
  await page.locator('#refresh-windows').click();await page.locator('#form-window').selectOption({label:'Dexterity practice form'});
  await page.locator('#inspect-form').click();
  try { await page.locator('[data-field-id]').first().waitFor({timeout:25000}); } catch(e) { console.log(await page.evaluate(()=>({snapshot:formSnapshot,working:formWorking,toast:$('toast').textContent,title:$('form-title').textContent})));throw e; }
  assert.equal(await page.locator('[data-field-id]').count(),2,'password field skipped');
  const inspected=await page.evaluate(()=>({title:formSnapshot.title,labels:formSnapshot.fields.map(f=>f.label)}));assert.match(inspected.title,/Dexterity practice form/);
  await page.getByLabel('Full name',{exact:true}).fill('Hackathon Builder');await page.getByLabel('Email address',{exact:true}).fill('builder@example.test');
  assert.equal(await page.locator('#submit-form').isDisabled(),true);
  await page.locator('#fill-fields').click();await page.getByText('Filled 2 fields. Nothing submitted yet.').waitFor();
  assert.equal(submitted,0,'filling does not submit');
  const snapshot=await page.evaluate(()=>formSnapshot);
  await assert.rejects(()=>page.evaluate(token=>window.dexterity.submitForm({token,buttonId:'button-0',confirmed:false}),snapshot.token),/confirm|Review/);
  await page.locator('#submit-button').selectOption({label:'Submit registration'});await page.locator('#review-confirm').check();
  fs.mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/form-review.png',fullPage:true});
  await page.locator('#submit-form').click();await page.getByText('Submission button activated. Check the target app for confirmation.',{exact:true}).first().waitFor();
  await new Promise(r=>setTimeout(r,400));assert.equal(submitted,1);
  await assert.rejects(()=>page.evaluate(token=>window.dexterity.submitForm({token,buttonId:'button-0',confirmed:true}),snapshot.token),/review|Fill/);
  console.log('PASS: actual UI Automation field inspection, password exclusion, filling, no implicit submission, explicit submission and duplicate prevention.');
  // Exercise the real microphone lifecycle, without storing audio or sending it online.
  const started=await page.evaluate(async()=>{try{await window.dexterity.listen();return {ok:true};}catch(e){return {ok:false,error:e.message};}});
  if(!started.ok)throw new Error('Microphone could not start: '+started.error);
  await new Promise(r=>setTimeout(r,300));
  assert.equal((await page.evaluate(()=>window.dexterity.nativeHealth())).listening,true);
  await page.evaluate(()=>window.dexterity.stopListening());
  await new Promise(r=>setTimeout(r,600));assert.equal((await page.evaluate(()=>window.dexterity.nativeHealth())).listening,false);
  console.log('PASS: actual microphone start, visible listening lifecycle, stop and release.');
 }finally{if(form)form.kill();await app.close();}
})().catch(e=>{console.error(e);process.exit(1);});
