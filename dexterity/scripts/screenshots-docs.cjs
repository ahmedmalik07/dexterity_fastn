// Documentation previews only: real renderer, fictional data, no desktop automation or AI calls.
const {chromium}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const output=path.resolve('docs/images');fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1020},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   const listeners=[];window.previewEvent=event=>listeners.forEach(listener=>listener(event));
   const methods={settings:async()=>({model:'gpt-5.4-mini',routerModel:'google/gemini-2.5-flash',voice:false,companion:true,encrypted:true,speechMode:'auto',speechLanguage:'en',speechPause:1.5,ctrlActivation:true,tripleActivation:true}),listFormWindows:async()=>[{id:'sample',title:'Application form — Google Chrome'}],nativeHealth:async()=>({recognizers:['English'],hooks:true}),getContext:async()=>({entries:[],activity:[],path:'Local encrypted context',rememberActivity:false})};
   methods.onNative=listener=>listeners.push(listener);
   window.dexterity=new Proxy(methods,{get:(obj,key)=>obj[key]||(String(key).startsWith('on')?()=>{}:async()=>({entries:[],activity:[],path:'Local encrypted context',rememberActivity:false}))});
  });
  await page.goto(pathToFileURL(path.resolve('ui/index.html')).href);
  await page.waitForFunction(()=>typeof prefs!=='undefined'&&prefs);
  await page.evaluate(()=>{openAssistant();document.getElementById('toast').hidden=true;document.getElementById('task-goal').value='Fill this form with my saved name and email. Let me review before submitting.';chooseTaskMode('do');});
  await page.screenshot({path:path.join(output,'workspace.png')});
  await page.evaluate(()=>{showPage('context');contextState={entries:[{id:'sample1',title:'About Alex',category:'profile',source:'Sample profile',text:'My name is Alex Builder. My email is alex@example.test. I am building a startup for a hackathon.',enabled:true},{id:'sample2',title:'How I like to learn',category:'preferences',source:'Sample imported context',text:'Use plain language. Teach me one step at a time. Point to the control you are explaining.',enabled:true}],activity:[],path:'Local encrypted context · sample data',rememberActivity:false};renderContext();document.getElementById('toast').hidden=true;});
  await page.screenshot({path:path.join(output,'context.png')});
  await page.evaluate(()=>{document.getElementById('memory-paste-open').click();document.getElementById('memory-paste-text').value='# About me\nMy name is Alex Builder. I am building a startup.\n\n# Learning preferences\nUse plain language. Teach one step at a time.\n\n# Current project\nPrepare a short product demonstration for a hackathon.';});
  await page.locator('#memory-paste').screenshot({path:path.join(output,'context-import.png')});
  await page.evaluate(()=>{showPage('forms');renderForm({token:'documentation-only',title:'Sample application form — Google Chrome',fields:[{id:'sample-name',label:'Full name',value:'Alex Builder'},{id:'sample-email',label:'Email address',value:'alex@example.test'},{id:'sample-project',label:'Project name',value:'Dexterity'}],buttons:[{id:'sample-submit',label:'Submit application'}]});document.getElementById('toast').hidden=true;});
  await page.screenshot({path:path.join(output,'form-fill.png'),fullPage:true});
  await page.evaluate(()=>{showPage('team');document.getElementById('page-label').textContent='How Dexterity works';});
  await page.screenshot({path:path.join(output,'agent-workflow.png'),fullPage:true});
  await page.evaluate(()=>{
   openAssistant();document.getElementById('task-result').hidden=false;
   for(const event of [
    {type:'task-start',id:'documentation-only'},
    {type:'task-context',title:'Sample application form — Google Chrome'},
    {type:'task-answer',answer:'The sample fields are ready for review. Check the values before approving Submit application.',provider:'Sample preview',model:'No live AI request'},
    {type:'task-step',message:'Sample action 1: enter Alex Builder in Full name.'},
    {type:'task-step',message:'Sample action 2: enter alex@example.test in Email address.'},
    {type:'task-review',action:'click',label:'Submit application',fields:[{name:'Full name',value:'Alex Builder'},{name:'Email address',value:'alex@example.test'}]}
   ])window.previewEvent(event);
  });
  await page.locator('#task-result').screenshot({path:path.join(output,'action-review.png')});
  await page.setViewportSize({width:340,height:260});
  await page.goto(pathToFileURL(path.resolve('ui/coach.html')).href);
  await page.evaluate(()=>{document.getElementById('answer').textContent='Ubiquitous means found everywhere. In this sentence, it describes something very common.';document.getElementById('point').hidden=true;document.getElementById('next').hidden=true;document.getElementById('stop').hidden=true;document.getElementById('provider').textContent='Sample answer · Mic off · Escape stops';});
  await page.screenshot({path:path.join(output,'companion.png'),omitBackground:true});
  await page.evaluate(()=>{document.getElementById('answer').textContent='Start with the Full name field. Click it, then enter your name. I’ll check the next step when you’re ready.';document.getElementById('point').hidden=false;document.getElementById('next').hidden=false;document.getElementById('provider').textContent='Sample lesson · Mic off · Escape stops';});
  await page.screenshot({path:path.join(output,'teaching.png'),omitBackground:true});
  await page.setViewportSize({width:380,height:260});
  await page.goto(pathToFileURL(path.resolve('ui/listening.html')).href);
  await page.evaluate(()=>{window.previewEvent({type:'voice-transcribing',engine:'OpenRouter'});document.getElementById('done').hidden=true;});
  await page.screenshot({path:path.join(output,'voice.png'),omitBackground:true});
  if(errors.length)throw Error(errors.join('\n'));
  console.log('Saved 9 current-renderer documentation previews with fictional data.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
