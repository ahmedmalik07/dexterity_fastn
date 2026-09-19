// Sends only the bundled test form image, never the user's desktop.
const {_electron:electron}=require('@playwright/test');
const assert=require('node:assert/strict');
(async()=>{
 const env={...process.env,DEXTERITY_SETUP:'1'};delete env.ELECTRON_RUN_AS_NODE;delete env.DEXTERITY_TEST;
 const desktop=await electron.launch({args:['.'],env});
 try{
  await desktop.firstWindow();
  const result=await desktop.evaluate(async({app,safeStorage,BrowserWindow})=>{
   const fs=process.mainModule.require('node:fs'),path=process.mainModule.require('node:path');
   const settings=JSON.parse(fs.readFileSync(path.join(app.getPath('appData'),'dexterity/preferences.json'),'utf8'));
   const key=safeStorage.decryptString(Buffer.from(settings.encryptedGeminiKey,'base64'));
   const window=new BrowserWindow({show:false,width:900,height:700,webPreferences:{contextIsolation:true,sandbox:true}});
   try{
    await window.loadFile(path.join(app.getAppPath(),'tests/browser-form.html'));
    const image=(await window.webContents.capturePage()).toDataURL();
    return await process.mainModule.require(path.join(app.getAppPath(),'electron/providers.cjs')).analyzeWithFallback({geminiKey:key},'Describe this form and identify the name field and the submit button. Give coordinates only for visible controls.',image);
   }finally{window.destroy();}
  });
  assert.equal(result.provider,'Gemini');assert.ok(result.steps.length>0);assert.match(JSON.stringify(result),/name|form/i);
  console.log(JSON.stringify({live:true,provider:result.provider,model:result.model,summary:result.summary,steps:result.steps.length,visibleTargets:result.steps.filter(s=>s.x!==null).length}));
 }finally{await desktop.close();}
})().catch(error=>{console.error('Live image verification failed:',error.message);process.exit(1);});
