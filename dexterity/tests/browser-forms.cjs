const { _electron: electron, chromium }=require('@playwright/test');
const {pathToFileURL}=require('node:url');const path=require('node:path');const assert=require('node:assert/strict');
(async()=>{
 const env={...process.env,DEXTERITY_TEST:'1'};delete env.ELECTRON_RUN_AS_NODE;
 const browser=await chromium.launch({channel:'chrome',headless:false});let app;
 try{
  const form=await browser.newPage();await form.goto(pathToFileURL(path.resolve('tests/browser-form.html')).href);
  app=await electron.launch({...(process.env.DEXTERITY_PACKAGED?{executablePath:path.resolve('release-v1.7/win-unpacked/Dexterity.exe')}:{}),args:process.env.DEXTERITY_PACKAGED?[]:['.'],env});await app.firstWindow();let page;
  for(let i=0;i<100;i++){page=app.windows().find(p=>p.url().endsWith('/index.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}
  await page.locator('#forms-nav').waitFor();await page.evaluate(()=>window.dexterity.nativeHealth());
  const windows=await page.evaluate(()=>window.dexterity.listFormWindows()),target=windows.find(w=>w.title.startsWith('Dexterity Browser Form Test'));
  assert.ok(target,'isolated browser test window found');
  const snapshot=await page.evaluate(id=>window.dexterity.inspectForm(false,id),target.id);
  assert.equal(snapshot.fields.length,2,'only form fields, no password or address bar');
  const name=snapshot.fields.find(f=>f.label==='Full name'),email=snapshot.fields.find(f=>f.label==='Email address');assert.ok(name&&email);
  await page.evaluate(({token,values})=>window.dexterity.fillForm({token,values}),{token:snapshot.token,values:{[name.id]:'Browser Builder',[email.id]:'browser@example.test'}});
  assert.equal(await form.locator('#name').inputValue(),'Browser Builder');assert.equal(await form.locator('#email').inputValue(),'browser@example.test');assert.equal(await form.evaluate(()=>window.submissions),0);
  const button=snapshot.buttons.find(b=>b.label==='Submit registration');assert.ok(button);
  await page.evaluate(data=>window.dexterity.submitForm(data),{token:snapshot.token,buttonId:button.id,confirmed:true});
  await form.getByText('Local form submitted',{exact:true}).waitFor();assert.equal(await form.evaluate(()=>window.submissions),1);
  console.log('PASS: real Chrome accessibility inspection, field filling and local form submission.');
  await form.evaluate(()=>{const p=document.createElement('p');p.id='word';p.textContent='ubiquitous';document.body.append(p);const range=document.createRange();range.selectNodeContents(p);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);});
  await page.waitForFunction(()=>typeof prefs!=='undefined'&&prefs);await page.evaluate(async()=>{prefs=await api.saveSettings({...prefs,voice:false,geminiKey:'test-only'});syncSettings();});
  await app.evaluate(()=>{globalThis.fetch=async(url,o)=>{const body=JSON.parse(o.body),input=JSON.parse(body.contents[0].parts[0].text);globalThis.testSelected=input.current.selectedText;return{ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({answer:'Ubiquitous means found everywhere.',status:'done',action:{type:'none',targetId:'',value:''}})}]}}]})};};});
  await app.evaluate(({BrowserWindow},id)=>{const main=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html'));main.hide();main.webContents.send('native:event',{type:'task-quick',goal:'Explain the selected word in context.',mode:'answer',windowId:id,companion:true});},target.id);
  await page.waitForFunction(()=>!taskRunning&&document.getElementById('task-answer').textContent==='Ubiquitous means found everywhere.',null,{polling:100});
  assert.match(await app.evaluate(()=>globalThis.testSelected),/ubiquitous/i);
  const coach=app.windows().find(p=>p.url().endsWith('/coach.html'));assert.equal(await coach.locator('#answer').innerText(),'Ubiquitous means found everywhere.');assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).isVisible()),false);
  console.log('PASS: highlighted browser text reaches the AI and its meaning appears beside the cursor, with dashboard hidden.');
 }finally{if(app)await app.close();await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
