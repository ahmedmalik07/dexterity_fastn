// Receives a credential on stdin. Never put secrets in arguments or source files.
const { _electron: electron } = require('@playwright/test');
const line = new Promise(resolve => require('node:readline').createInterface({input:process.stdin}).once('line', resolve));
void (async () => {
 let desktop, stage='validation';
 try {
  const key = (await line).trim().replace(/\\_/g,'_');
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash', {headers:{'x-goog-api-key':key},signal:AbortSignal.timeout(20000)});
  if (!response.ok) { const data=await response.json().catch(()=>({})); console.log(JSON.stringify({valid:false,httpStatus:response.status,status:data.error?.status||'rejected'})); return; }
  console.log(JSON.stringify({valid:true,modelAccessible:true}));stage='desktop launch';
  const env={...process.env,DEXTERITY_SETUP:'1'};delete env.ELECTRON_RUN_AS_NODE;delete env.DEXTERITY_TEST;
  desktop=await electron.launch({args:['.'],env});await desktop.firstWindow();
  stage='encrypted storage';await desktop.evaluate(({app,safeStorage},key)=>{
  const fs=process.mainModule.require('node:fs'),path=process.mainModule.require('node:path');
  if(!safeStorage.isEncryptionAvailable())throw new Error('Windows encryption unavailable');
  const dir=path.join(app.getPath('appData'),'dexterity');fs.mkdirSync(dir,{recursive:true});
  const file=path.join(dir,'preferences.json'); let prefs={};
  try {prefs=JSON.parse(fs.readFileSync(file,'utf8'));} catch {try{prefs=JSON.parse(fs.readFileSync(path.join(app.getPath('appData'),'clicky/preferences.json'),'utf8'));}catch{}}
  prefs.encryptedGeminiKey=safeStorage.encryptString(key).toString('base64'); prefs.model='gpt-5.4-mini';prefs.demo=false;
  fs.writeFileSync(file,JSON.stringify(prefs));
  },key);
  console.log(JSON.stringify({valid:true,savedEncrypted:true}));
 } catch (error) {console.log(JSON.stringify({saved:false,stage,code:error.cause?.code || error.name}));}
 finally {if(desktop)await desktop.close();process.exit();}
})();
