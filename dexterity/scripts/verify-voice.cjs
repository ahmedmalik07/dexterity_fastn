// Uses synthesized sample speech as the microphone source. Never sends room audio.
const{_electron:electron}=require('@playwright/test');
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const env={...process.env,DEXTERITY_SETUP:'1'};delete env.ELECTRON_RUN_AS_NODE;delete env.DEXTERITY_TEST;
 const desktop=await electron.launch({args:['.','--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture='+path.resolve('test-results/speech.wav')],env});
 try{
  await desktop.firstWindow();let page,listener;
  for(let i=0;i<100;i++){page=desktop.windows().find(p=>p.url().endsWith('/index.html'));listener=desktop.windows().find(p=>p.url().endsWith('/listening.html'));if(page&&listener)break;await new Promise(r=>setTimeout(r,100));}
  await page.waitForFunction(()=>typeof prefs!=='undefined'&&prefs);
  await page.evaluate(()=>{prefs.voice=false;document.getElementById('task-screen').checked=false;return api.listen();});
  await listener.waitForFunction(()=>recording?.recorder?.state==='recording');
  await new Promise(r=>setTimeout(r,5000));await page.evaluate(()=>api.finishListening());
  try{await page.waitForFunction(()=>/explain.*screen/i.test(document.getElementById('question').value),null,{timeout:40000});}
  catch(error){throw new Error(await page.locator('#toast').textContent()||error.message);}
  const text=await page.locator('#question').inputValue();assert.match(text,/buttons/i);
  console.log(JSON.stringify({live:true,provider:'Gemini',input:'Synthesized test speech via microphone recorder',transcript:text}));
 }finally{await desktop.close();}
})().catch(error=>{console.error('Voice check failed:',error.message);process.exit(1);});
