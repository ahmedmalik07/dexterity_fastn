// Live provider rehearsal. Only generated speech and an owned local test website are shared.
const {_electron:electron,chromium}=require('@playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{execFileSync}=require('node:child_process');
(async()=>{
 fs.mkdirSync('test-results',{recursive:true});const results=[],audio=path.resolve('test-results/demo-question.wav');
 execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','RemoteSigned','-File',path.resolve('scripts/test-audio.ps1'),'-OutputFile',audio,'-Text','What does ubiquitous mean? Give one simple example.'],{windowsHide:true});
 const html=fs.readFileSync('tests/browser-form.html','utf8').replaceAll('Dexterity Browser Form Test','Dexterity Live Demo');
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');if(req.url==='/start')res.setHeader('Set-Cookie','dexterity_demo_session=existing; HttpOnly; SameSite=Lax; Path=/');const signed=(req.headers.cookie||'').includes('dexterity_demo_session=existing');res.end(html.replace('<h1>Local browser form test</h1>',`<h1>${req.url==='/start'?'Demo home':signed?'Existing demo session preserved':'Missing demo session'}</h1><p>This is a local rehearsal form; submissions stay on this page.</p>`));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
 let browser,desktop,page;
 async function check(name,fn){const start=Date.now();try{await fn();results.push({task:name,status:'PASS',seconds:Math.round((Date.now()-start)/1000)});console.log('PASS: '+name);}catch(e){results.push({task:name,status:'FAIL',reason:e.message.slice(0,350)});console.log('FAIL: '+name+' — '+e.message.slice(0,350));if(page)await page.evaluate(()=>api.stopTask()).catch(()=>{});}}
 async function run(goal,mode,windowId){await page.evaluate(async({goal,mode,windowId})=>{await api.clearTask();document.getElementById('task-screen').checked=true;document.getElementById('task-memory').checked=false;await startTask(goal,{mode,windowId,companion:true});},{goal,mode,windowId});}
 async function done(){await page.waitForFunction(()=>!taskRunning,null,{timeout:125000,polling:100});const state=await page.locator('#task-status').innerText();if(!state.startsWith('Done'))throw Error(await page.locator('#task-answer').innerText());}
 try{
  browser=await chromium.launch({channel:'chrome',headless:false});const original=await browser.newPage();await original.goto(origin+'/start');
  const env={...process.env,DEXTERITY_SETUP:'1'};delete env.DEXTERITY_TEST;delete env.ELECTRON_RUN_AS_NODE;
  desktop=await electron.launch({...(process.env.DEXTERITY_PACKAGED?{executablePath:path.resolve('release-v1.7/win-unpacked/Dexterity.exe')}:{}),args:[...(process.env.DEXTERITY_PACKAGED?[]:['.']),'--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture='+audio],env});
  await desktop.firstWindow();for(let i=0;i<100;i++){page=desktop.windows().find(p=>p.url().endsWith('/index.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}await page.waitForFunction(()=>typeof prefs!=='undefined'&&prefs);
  assert.ok(await page.evaluate(()=>prefs.hasRouterKey),'Configure OpenRouter in the app before live rehearsal.');
  await page.evaluate(()=>{prefs.voice=false;document.getElementById('task-memory').checked=false;document.getElementById('task-screen').checked=false;});
  await desktop.evaluate(({BrowserWindow})=>{const main=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html'));main.hide();globalThis.demoShows=0;main.on('show',()=>globalThis.demoShows++);});
  const target=(await page.evaluate(()=>api.listFormWindows())).find(w=>w.title.startsWith('Dexterity Live Demo'));assert.ok(target,'Owned demo browser is available');
  await check('1. Live voice and highlighted-word meanings beside the cursor',async()=>{
   await page.evaluate(()=>api.listen());await page.waitForFunction(()=>document.getElementById('task-result').hidden===false,null,{timeout:65000,polling:100});await done();assert.match(await page.locator('#task-answer').innerText(),/everywhere|widespread|all places/i);assert.equal(await desktop.evaluate(()=>globalThis.demoShows),0);assert.match(await page.locator('#task-provider').innerText(),/OpenRouter/);
   await original.evaluate(()=>{const p=document.createElement('p');p.textContent='ubiquitous';document.body.append(p);const range=document.createRange();range.selectNodeContents(p);window.getSelection().removeAllRanges();window.getSelection().addRange(range);});
   await desktop.evaluate(()=>{const fetcher=globalThis.fetch;globalThis.demoObservedSelection='';globalThis.fetch=(url,options)=>{try{const body=JSON.parse(options.body),input=JSON.parse(body.messages[1].content.find(p=>p.type==='text').text);if(input.current?.selectedText)globalThis.demoObservedSelection=input.current.selectedText;}catch{}return fetcher(url,options);};});
   await run('Explain the selected word in context and give one example.','answer',target.id);await done();assert.equal(await desktop.evaluate(()=>globalThis.demoObservedSelection),'ubiquitous');assert.match(await page.locator('#task-answer').innerText(),/everywhere|widespread|all places/i);assert.equal(await desktop.evaluate(()=>globalThis.demoShows),0);
  });
  let form=original;
  await check('2. Live agent opens a tab in the existing browser session',async()=>{
   await run(`Open ${origin}/registration in a new tab in this same browser window. Do not fill or submit anything. Finish when the page says Existing demo session preserved.`,'do',target.id);await done();form=original.context().pages().find(p=>p.url()===origin+'/registration');assert.ok(form,'Agent created the requested tab in the same context');await form.getByText('Existing demo session preserved',{exact:true}).waitFor();assert.equal(original.url(),origin+'/start');
  });
  await check('3. Live agent fills a browser form, pauses, submits and verifies',async()=>{
   await run('Fill Full name with Alex Builder and Email address with alex@example.test. Leave Password empty. Then submit the registration after my explicit approval. Finish only when Local form submitted is visible.','do',target.id);
   await page.waitForFunction(()=>!document.getElementById('task-review').hidden||!taskRunning,null,{timeout:125000,polling:100});
   if(await page.locator('#task-review').isHidden())throw Error('No submission review: '+await page.locator('#task-answer').innerText());
   assert.equal(await form.locator('#name').inputValue(),'Alex Builder');assert.equal(await form.locator('#email').inputValue(),'alex@example.test');assert.equal(await form.evaluate(()=>window.submissions),0);
   await page.locator('#task-approve').click();await done();assert.equal(await form.evaluate(()=>window.submissions),1);assert.equal(await form.locator('#password').inputValue(),'');
  });
  await check('4. Live visual teaching with a usable pointer',async()=>{
   await run('Teach me how to fill this form. Give one first step and point at the Full name field.','teach',target.id);await done();const coach=desktop.windows().find(p=>p.url().endsWith('/coach.html'));assert.match(await coach.locator('#answer').innerText(),/name/i);await coach.locator('#point').waitFor({state:'visible',timeout:5000});await coach.locator('#point').click();assert.equal(await coach.locator('#notice').innerText(),'');await coach.screenshot({path:'test-results/demo-teaching.png'});
  });
 }finally{
  fs.writeFileSync('test-results/demo-live-report.json',JSON.stringify({date:new Date().toISOString(),provider:'Live configured OpenRouter',audio:'Generated speech, not human accent evaluation',site:'Owned local fixture with generated session cookie',results},null,2));
  if(desktop)await desktop.close();if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));
 }
 if(results.length!==4||results.some(r=>r.status!=='PASS'))process.exitCode=1;
})().catch(e=>{console.error('Live demo setup:',e.message);process.exitCode=1;});
