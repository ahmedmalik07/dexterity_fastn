// Checks the real microphone locally. Cancels before upload; no room audio leaves the PC.
const{_electron:electron}=require('@playwright/test');const assert=require('node:assert/strict');
(async()=>{
 const env={...process.env,DEXTERITY_TEST:'1'};delete env.ELECTRON_RUN_AS_NODE;
 const desktop=await electron.launch({args:['.'],env});
 try{
  await desktop.firstWindow();let page,listener;
  for(let i=0;i<100;i++){page=desktop.windows().find(p=>p.url().endsWith('/index.html'));listener=desktop.windows().find(p=>p.url().endsWith('/listening.html'));if(page&&listener)break;await new Promise(r=>setTimeout(r,100));}
  await page.waitForFunction(()=>typeof prefs!=='undefined'&&prefs);
  await desktop.evaluate(()=>{globalThis.uploads=0;globalThis.fetch=()=>{globalThis.uploads++;throw new Error('Network disabled in microphone check');};});
  await page.evaluate(async()=>{prefs=await api.saveSettings({...prefs,geminiKey:'test-no-upload',speechMode:'gemini'});await api.listen();});
  await listener.waitForFunction(()=>recording?.recorder?.state==='recording');
  await listener.evaluate(()=>globalThis.testStream=recording.stream);
  assert.equal(await listener.evaluate(()=>testStream.getAudioTracks()[0].readyState),'live');
  await page.evaluate(()=>api.stopListening());
  await listener.waitForFunction(()=>testStream.getAudioTracks()[0].readyState==='ended');
  assert.equal(await desktop.evaluate(()=>globalThis.uploads),0);
  console.log('PASS: real microphone starts in the new recorder, releases on cancel, and uploads no audio.');
 }finally{await desktop.close();}
})().catch(error=>{console.error(error.message);process.exit(1);});
