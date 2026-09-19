const {_electron:electron}=require('@playwright/test');
const assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
 const env={...process.env,DEXTERITY_TEST:'1'};delete env.ELECTRON_RUN_AS_NODE;
 const desktop=await electron.launch({...(process.env.DEXTERITY_PACKAGED?{executablePath:path.resolve('release-v1.4/win-unpacked/Dexterity.exe')}:{}),args:[...(process.env.DEXTERITY_PACKAGED?[]:['.']),'--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture='+path.resolve('test-results/speech.wav')],env});
 try{
  await desktop.firstWindow();let page,listener;
  for(let i=0;i<100;i++){page=desktop.windows().find(p=>p.url().endsWith('/index.html'));listener=desktop.windows().find(p=>p.url().endsWith('/listening.html'));if(page&&listener)break;await new Promise(r=>setTimeout(r,100));}
  await page.waitForFunction(()=>typeof prefs!=='undefined'&&prefs);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));listener.on('pageerror',e=>errors.push(e.message));
  await page.evaluate(async()=>{prefs=await api.saveSettings({...prefs,voice:false,geminiKey:'test-only',speechMode:'auto'});syncSettings();});
  // Isolate recording/transcription here. Task execution is covered in tasks.cjs.
  await page.evaluate(()=>{startTask=async text=>{document.getElementById('question').value=text;};});
  await desktop.evaluate(()=>{globalThis.voiceCalls=0;globalThis.fetch=async(url,o)=>{globalThis.voiceCalls++;const body=JSON.parse(o.body);if(body.contents[0].parts[1].inline_data.mime_type!=='audio/webm')throw new Error('Wrong audio type');if(body.contents[0].parts[1].inline_data.data.length<1000)throw new Error('Missing recorded audio');return{ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({text:'Please explain this screen.'})}]}}]})};};});
  await page.evaluate(()=>api.listen());
  await listener.waitForFunction(()=>recording?.recorder?.state==='recording',{timeout:15000});
  await listener.waitForFunction(()=>!document.getElementById('done').disabled);
  await listener.screenshot({path:'test-results/voice-card.png'});
  const tracks=await listener.evaluate(()=>{globalThis.previousStream=recording.stream;return recording.stream.getAudioTracks().length;});assert.equal(tracks,1);
  await new Promise(r=>setTimeout(r,1300));await page.evaluate(()=>api.finishListening());
  await page.waitForFunction(()=>document.getElementById('question').value==='Please explain this screen.');
  assert.equal(await desktop.evaluate(()=>globalThis.voiceCalls),1);assert.equal(await listener.evaluate(()=>previousStream.getTracks().every(t=>t.readyState==='ended')),true);
  console.log('PASS: recorded audio reaches Gemini bridge; transcript shown for review; microphone released.');
  await page.evaluate(()=>{document.getElementById('question').value='Keep this';return api.listen();});
  await listener.waitForFunction(()=>recording?.recorder?.state==='recording');
  const id=await listener.evaluate(()=>recording.id);
  await page.evaluate(id=>api.voiceAudio({id,audio:new ArrayBuffer(1000),mimeType:'audio/webm'}),id);
  assert.equal(await desktop.evaluate(()=>globalThis.voiceCalls),1,'dashboard cannot submit audio');
  await page.evaluate(()=>api.stopListening());await listener.waitForFunction(()=>recording===null);
  assert.equal(await desktop.evaluate(()=>globalThis.voiceCalls),1,'cancel before finish never sends audio');
  await desktop.evaluate(()=>{globalThis.fetch=()=>{globalThis.voiceCalls++;return new Promise(resolve=>globalThis.resolveSpeech=()=>resolve({ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({text:'stale transcript'})}]}}]})}));};});
  await page.evaluate(()=>api.listen());await listener.waitForFunction(()=>recording?.recorder?.state==='recording');await new Promise(r=>setTimeout(r,1000));await page.evaluate(()=>api.finishListening());
  await listener.getByText('Writing what you said…').waitFor();await page.evaluate(()=>api.stopListening());await desktop.evaluate(()=>globalThis.resolveSpeech());
  await new Promise(r=>setTimeout(r,500));assert.equal(await page.locator('#question').inputValue(),'Keep this');
  assert.deepEqual(errors,[]);console.log('PASS: cancellation, stale result suppression, sender isolation and renderer lifecycle.');
 }finally{await desktop.close();}
})().catch(error=>{console.error(error);process.exit(1);});
