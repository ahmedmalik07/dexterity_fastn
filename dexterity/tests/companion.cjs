const{_electron:electron}=require('@playwright/test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const env={...process.env,DEXTERITY_TEST:'1'};delete env.ELECTRON_RUN_AS_NODE;
 const desktop=await electron.launch({...(process.env.DEXTERITY_PACKAGED?{executablePath:path.resolve('release-v1.9/win-unpacked/Dexterity.exe')}:{}),args:[...(process.env.DEXTERITY_PACKAGED?[]:['.']),'--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture='+path.resolve('test-results/speech.wav')],env});
 let editor;
 try{
  await desktop.firstWindow();let page;for(let attempt=0;attempt<200;attempt++){page=desktop.windows().find(p=>p.url().endsWith('/index.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}assert.ok(page,'Dashboard loaded');
  page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.waitForFunction(()=>typeof prefs!=='undefined'&&prefs);
  assert.equal(await page.locator('#companion-home').isVisible(),true);assert.equal(await page.locator('#forms-nav').isVisible(),true);
  await page.locator('[data-page="conversations"]').click();await page.locator('#remember-chats').check();await page.locator('[data-page="companion-home"]').click();
  await page.evaluate(async()=>{prefs=await api.saveSettings({...prefs,voice:false,routerKey:'fixture'});});
  await desktop.evaluate(()=>{globalThis.companionRequests=[];globalThis.voiceRequests=0;globalThis.fetch=async(url,o)=>{
   const body=JSON.parse(o.body);
   if(body.messages[1].content.some(c=>c.type==='input_audio')){globalThis.voiceRequests++;return{ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({text:'Where is the color panel?'})}}]})};}
   const input=JSON.parse(body.messages[1].content[0].text);globalThis.companionRequests.push(input);
   const answer=input.mode==='teach'?'Open the color panel. It contains the adjustment tools.':input.history.length?'Contrast is the difference between light and dark areas.':'I can help you understand this.';
   return{ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({answer,status:'done',action:{type:'none',targetId:'',value:''},target:body.messages[1].content.some(c=>c.type==='image_url')?{x:.5,y:.5,label:'Color panel'}:null})}}]})};
  };});
  await page.locator('#home-type').click();const coach=desktop.windows().find(p=>p.url().endsWith('/coach.html'));coach.setDefaultTimeout(15000);coach.on('pageerror',e=>errors.push(e.message));
  await coach.locator('#share-screen').uncheck();await coach.locator('#message').fill('Explain contrast');await coach.locator('#send').click();
  await coach.getByText('I can help you understand this.',{exact:true}).waitFor();
  assert.equal(await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).isVisible()),false);
  await coach.locator('#message').fill('Can you explain that more simply?');await coach.locator('#send').click();await coach.getByText('Contrast is the difference between light and dark areas.',{exact:true}).waitFor();
  const requests=await desktop.evaluate(()=>globalThis.companionRequests);assert.equal(requests.length,2);assert.equal(requests[1].history.length,1);assert.equal(requests[0].current.title,'No screen shared');
  const history=await page.evaluate(()=>api.conversations());assert.equal(history.chats.length,1);assert.equal(history.chats[0].turns.length,2);
  await coach.locator('#message').fill('Teach me color grading');await coach.locator('#send').click();await coach.locator('#next').waitFor({state:'visible'});await coach.locator('#next').click();
  await page.waitForFunction(()=>!taskRunning,null,{polling:100});
  const lessons=await desktop.evaluate(()=>globalThis.companionRequests);assert.match(lessons.at(-1).goal,/Continue this lesson: Teach me color grading/);assert.equal(lessons.at(-1).mode,'teach');
  fs.mkdirSync('test-results',{recursive:true});await coach.screenshot({path:'test-results/companion-conversation.png'});
  await coach.locator('#new-chat').click();await coach.locator('#message').fill('Open this menu');await coach.locator('#send').click();await coach.getByText('I can help you understand this.',{exact:true}).waitFor();assert.equal((await desktop.evaluate(()=>globalThis.companionRequests)).at(-1).mode,'answer');
  await page.evaluate(()=>api.open());await page.screenshot({path:'test-results/companion-home.png'});
  editor=await electron.launch({args:[path.resolve('tests/editor-window.cjs')],env});await editor.firstWindow();await editor.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].focus());
  await page.evaluate(()=>api.listen());const listener=desktop.windows().find(p=>p.url().endsWith('/listening.html'));
  await listener.waitForFunction(()=>recording?.recorder?.state==='recording',null,{polling:100,timeout:15000});
  await new Promise(r=>setTimeout(r,1500));await page.evaluate(()=>api.finishListening());
  await coach.locator('#point').waitFor({state:'visible',timeout:45000});
  assert.equal(await desktop.evaluate(()=>globalThis.voiceRequests),1);
  assert.equal((await desktop.evaluate(()=>globalThis.companionRequests)).at(-1).mode,'teach');
  const pointer=desktop.windows().find(p=>p.url().endsWith('/pointer.html'));
  try{await pointer.locator('ellipse').waitFor({state:'attached',timeout:15000});}catch(error){console.error('Marker notice:',await coach.locator('#notice').textContent());console.error('Observation:',JSON.stringify((await desktop.evaluate(()=>globalThis.companionRequests)).at(-1).current));throw error;}
  assert.equal(await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).isVisible()),false);
  await page.evaluate(()=>api.voiceConversation(true));
  await listener.waitForFunction(()=>recording?.recorder?.state==='recording',null,{polling:100,timeout:15000});
  const firstHandsfreeId=await listener.evaluate(()=>recording.id);
  await new Promise(r=>setTimeout(r,1500));await page.evaluate(()=>api.finishListening());
  await listener.waitForFunction(id=>recording?.id!==id&&recording?.recorder?.state==='recording',firstHandsfreeId,{polling:100,timeout:45000});
  assert.equal(await page.evaluate(async()=>(await api.voiceConversationState()).active),true);
  await listener.evaluate(()=>globalThis.lastHandsfreeStream=recording.stream);await page.evaluate(()=>api.voiceConversation(false));
  await listener.waitForFunction(()=>lastHandsfreeStream.getTracks().every(t=>t.readyState==='ended'),null,{polling:100,timeout:5000});
  assert.equal(await page.evaluate(async()=>(await api.voiceConversationState()).active),false);
  await page.evaluate(()=>api.open());await page.locator('[data-page="conversations"]').click();await page.locator('#conversation-list .background-card').first().waitFor();
  await page.screenshot({path:'test-results/conversation-history.png'});
  assert.deepEqual(errors,[]);console.log('PASS: companion, saved history, typed and voice follow-ups, screen guidance, hands-free automatic rearm, Stop releases microphone, dashboard stays hidden.');
 }finally{if(editor)await editor.close();await desktop.close();}
})().catch(e=>{console.error(e);process.exit(1);});
