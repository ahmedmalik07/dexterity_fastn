// Sends only an owned sample editor image and generated speech, never the desktop.
const{_electron:electron}=require('@playwright/test'),assert=require('node:assert/strict');
(async()=>{
 const env={...process.env,DEXTERITY_SETUP:'1'};delete env.ELECTRON_RUN_AS_NODE;delete env.DEXTERITY_TEST;
 const desktop=await electron.launch({args:['.'],env});
 try{
  await desktop.firstWindow();
  const result=await desktop.evaluate(async({app,safeStorage,BrowserWindow})=>{
   const req=process.mainModule.require,fs=req('node:fs'),path=req('node:path'),saved=JSON.parse(fs.readFileSync(path.join(app.getPath('userData'),'preferences.json'),'utf8'));
   const settings={model:saved.model,routerModel:saved.routerModel};
   for(const[name,field]of[['routerKey','encryptedRouterKey'],['geminiKey','encryptedGeminiKey'],['key','encryptedKey']])if(saved[field])settings[name]=safeStorage.decryptString(Buffer.from(saved[field],'base64'));
   if(!settings.routerKey&&!settings.geminiKey&&!settings.key)throw new Error('No saved provider connection.');
   const fixture=new BrowserWindow({show:false,width:1000,height:640,webPreferences:{contextIsolation:true,sandbox:true}});
   try{
    await fixture.loadFile(path.join(app.getAppPath(),'tests/editor-scene.html'));
    const image=(await fixture.webContents.capturePage()).toDataURL();
    const answer=await req(path.join(app.getAppPath(),'electron/agent.cjs')).plan(settings,{goal:'Show me where the Contrast slider is in this editor and briefly explain what it changes.',mode:'teach',context:{title:'Sample photo editor',image,text:'',selectedText:'',controls:[]},history:[],progress:[]},AbortSignal.timeout(45000));
    return{answer:answer.answer,target:answer.target,provider:answer.provider,model:answer.model};
   }finally{fixture.destroy();}
  });
  assert.match(result.answer,/contrast/i);assert.ok(result.target&&result.target.x>.65&&result.target.x<1&&result.target.y>.25&&result.target.y<.65,'Marker locates the Contrast region in the sample editor');
  console.log('PASS: live '+result.provider+' / '+result.model+' explained Contrast and located it in the rendered editor screenshot.');
 }finally{await desktop.close();}
})().catch(error=>{console.error(error.message);process.exit(1);});
