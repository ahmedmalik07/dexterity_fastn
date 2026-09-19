const{_electron:electron}=require('@playwright/test');const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const env={...process.env,DEXTERITY_TEST:'1'};delete env.ELECTRON_RUN_AS_NODE;
 const desktop=await electron.launch({...(process.env.DEXTERITY_PACKAGED?{executablePath:path.resolve('release-v1.7/win-unpacked/Dexterity.exe')}:{}),args:[...(process.env.DEXTERITY_PACKAGED?[]:['.']),'--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture='+path.resolve('test-results/speech.wav')],env});
 try{
  await desktop.firstWindow();let page,listener;
  for(let i=0;i<100;i++){page=desktop.windows().find(p=>p.url().endsWith('/index.html'));listener=desktop.windows().find(p=>p.url().endsWith('/listening.html'));if(page&&listener)break;await new Promise(r=>setTimeout(r,100));}
  await page.waitForFunction(()=>typeof prefs!=='undefined'&&prefs);
  await page.evaluate(async()=>{prefs=await api.saveSettings({...prefs,voice:false,geminiKey:'test-only'});syncSettings();document.getElementById('task-screen').checked=false;});
  await desktop.evaluate(({BrowserWindow})=>{globalThis.voiceRequests=0;globalThis.answerRequests=0;globalThis.dashboardShows=0;const main=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html'));main.hide();main.on('show',()=>globalThis.dashboardShows++);globalThis.fetch=async(url,o)=>{const body=JSON.parse(o.body);let result;if(body.contents[0].parts.some(p=>p.inline_data?.mime_type==='audio/webm')){globalThis.voiceRequests++;result={text:'What does ubiquitous mean?'};}else{globalThis.answerRequests++;const input=JSON.parse(body.contents[0].parts[0].text);if(input.goal!=='What does ubiquitous mean?'||input.mode!=='answer')throw new Error('Transcript did not reach task flow');result={answer:'Ubiquitous means found everywhere.',status:'done',action:{type:'none',targetId:'',value:''}};}return{ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(result)}]}}]})};};});
  await page.evaluate(()=>api.listen());await listener.waitForFunction(()=>recording?.recorder?.state==='recording');await new Promise(r=>setTimeout(r,1200));await page.evaluate(()=>api.finishListening());
  await page.waitForFunction(()=>!taskRunning&&document.getElementById('task-answer').textContent==='Ubiquitous means found everywhere.',{},{polling:100,timeout:25000});
  assert.deepEqual(await desktop.evaluate(()=>[globalThis.voiceRequests,globalThis.answerRequests]),[1,1]);
  assert.equal(await desktop.evaluate(()=>globalThis.dashboardShows),0);
  const coach=desktop.windows().find(p=>p.url().endsWith('/coach.html'));assert.equal(await coach.locator('#answer').innerText(),'Ubiquitous means found everywhere.');
  console.log('PASS: microphone → transcription → automatic answer beside cursor, with no Run click or dashboard opening.');
  await desktop.evaluate(()=>{globalThis.voiceRequests=0;globalThis.taskRequests=0;globalThis.fetch=async(url,o)=>{
   const body=JSON.parse(o.body);let result;
   if(body.contents[0].parts.some(p=>p.inline_data?.mime_type==='audio/webm')){globalThis.voiceRequests++;result={text:'Fill this form with name Alex Builder and email alex@example.test. Submit after I review it.'};}
   else{globalThis.taskRequests++;const input=JSON.parse(body.contents[0].parts[0].text);
    if(input.mode==='coordinate')result={summary:'Fill the form and review submission.',steps:['Fill name and email.','Review and submit.'],success:'Submitted: Alex Builder is visible.'};
    else if(input.mode==='verify')result={complete:input.current.text.includes('Submitted: Alex Builder'),reason:'Checked visible confirmation',checks:[]};
    else{if(input.mode!=='do')throw new Error('Voice action request did not choose Do it');const controls=input.current.controls,name=controls.find(c=>c.name==='Full name'&&c.actions.includes('type')),email=controls.find(c=>c.name==='Email address'&&c.actions.includes('type'));if(!name||!email)throw new Error('Voice did not preserve the target form');
     if(name.value!=='Alex Builder')result={answer:'Filling name.',status:'continue',action:{type:'type',targetId:name.id,value:'Alex Builder'}};
     else if(email.value!=='alex@example.test')result={answer:'Filling email.',status:'continue',action:{type:'type',targetId:email.id,value:'alex@example.test'}};
     else if(input.current.text.includes('Submitted: Alex Builder'))result={answer:'Voice form task complete.',status:'done',action:{type:'none',targetId:'',value:''}};
     else result={answer:'Review submission.',status:'continue',action:{type:'click',targetId:controls.find(c=>c.name==='Submit registration').id,value:''}};
    }
   }return{ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(result)}]}}]})};
  };});
  await page.evaluate(async()=>{document.getElementById('task-screen').checked=true;chooseTaskMode('answer');await api.practiceForm();await api.listen();});
  await listener.waitForFunction(()=>recording?.recorder?.state==='recording',{},{polling:100});await new Promise(r=>setTimeout(r,1200));await page.evaluate(()=>api.finishListening());
  await page.locator('#task-review').waitFor({state:'visible',timeout:60000});
  assert.equal(await page.locator('#task-log li[data-kind="action"]').count(),2);assert.match(await page.locator('#task-review-fields').innerText(),/Alex Builder/);
  assert.equal(await desktop.evaluate(()=>globalThis.dashboardShows),1,'only protected action approval opens dashboard');
  assert.equal(await desktop.evaluate(()=>globalThis.voiceRequests),1);
  await page.locator('#task-approve').click();
  await page.waitForFunction(()=>!taskRunning&&document.getElementById('task-answer').textContent==='Voice form task complete.',{},{polling:100,timeout:30000});
  assert.equal(await page.locator('#task-log li[data-kind="action"]').count(),3);assert.equal(await desktop.evaluate(()=>globalThis.dashboardShows),1);
  console.log('PASS: spoken task → remembered real form → automatic field actions → protected submission approval → verified result.');
  const prior=await desktop.evaluate(()=>globalThis.taskRequests);
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).webContents.send('native:event',{type:'transcript',text:'Stop.'}));
  await page.waitForTimeout(300);assert.equal(await desktop.evaluate(()=>globalThis.taskRequests),prior);assert.equal(await page.evaluate(()=>taskRunning),false);
  console.log('PASS: spoken Stop does not start another task.');
  // Turning the review on must bring the dashboard forward; otherwise the recognised text lands in a hidden window.
  await page.evaluate(async()=>{prefs=await api.saveSettings({...prefs,voiceReview:true});syncSettings();});
  const shownBefore=await desktop.evaluate(()=>globalThis.dashboardShows);
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).hide());
  await page.evaluate(()=>api.listen());await listener.waitForFunction(()=>recording?.recorder?.state==='recording',{},{polling:100});
  await new Promise(r=>setTimeout(r,1200));await page.evaluate(()=>api.finishListening());
  await page.locator('#heard-review').waitFor({state:'visible',timeout:25000});
  assert.ok(await desktop.evaluate(()=>globalThis.dashboardShows)>shownBefore,'the review must open the dashboard, not hide in it');
  assert.equal(await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).isVisible()),true);
  await page.locator('#voice-heard-cancel').click();
  console.log('PASS: optional voice review opens the dashboard and can be cancelled.');
 }finally{await desktop.close();}
})().catch(e=>{console.error(e);process.exit(1);});
