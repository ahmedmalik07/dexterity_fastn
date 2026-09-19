// Read-only check of the installed user's encrypted key in the packaged app.
const {_electron:electron}=require('@playwright/test');
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const env={...process.env,DEXTERITY_SETUP:'1'};delete env.ELECTRON_RUN_AS_NODE;delete env.DEXTERITY_TEST;
 const app=await electron.launch({executablePath:path.resolve('release-v1.4/win-unpacked/Dexterity.exe'),args:[],env});
 try{
  await app.firstWindow();let page;
  for(let i=0;i<100;i++){page=app.windows().find(p=>p.url().endsWith('/index.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}
  const prefs=await page.evaluate(()=>window.dexterity.settings());
  assert.equal(prefs.hasGeminiKey,true);assert.equal(prefs.hasAIKey,true);assert.equal(prefs.geminiKey,undefined);assert.equal(prefs.model,'gpt-5.4-mini');
  console.log('PASS: packaged app reads the encrypted saved Gemini key after restart; key remains outside renderer.');
 }finally{await app.close();}
})().catch(error=>{console.error(error.message);process.exit(1);});
