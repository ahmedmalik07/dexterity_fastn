const{_electron:electron}=require('@playwright/test');const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const env={...process.env,DEXTERITY_TEST:'1'};delete env.ELECTRON_RUN_AS_NODE;
 const desktop=await electron.launch({...(process.env.DEXTERITY_PACKAGED?{executablePath:path.resolve('release-v1.7/win-unpacked/Dexterity.exe')}:{}),args:[...(process.env.DEXTERITY_PACKAGED?[]:['.'])],env});
 try{
  await desktop.firstWindow();let page;
  for(let i=0;i<100;i++){page=desktop.windows().find(p=>p.url().endsWith('/index.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}
  await page.waitForFunction(()=>typeof prefs!=='undefined'&&prefs);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.evaluate(async()=>{prefs=await api.saveSettings({...prefs,voice:false,geminiKey:'test-only'});syncSettings();});
  await desktop.evaluate(()=>{globalThis.taskProbe=[];globalThis.fetch=async(url,o)=>{
   const body=JSON.parse(o.body),input=JSON.parse(body.contents[0].parts[0].text);let result;
   const none=answer=>({answer,status:'done',action:{type:'none',targetId:'',value:''}});
   if(input.mode==='coordinate'){if(!input.personalContext.some(e=>e.title==='Form profile'))throw new Error('Coordinator did not receive saved profile');result={summary:'Fill the registration form using saved details and review submission.',steps:['Fill the saved name and email.','Review and submit.','Check the confirmation.'],success:'The form shows Submitted: Alex Builder.'};}
   else if(input.mode==='verify')result={complete:input.current.text.includes('Submitted: Alex Builder'),reason:'Checked the sample form confirmation',checks:[]};
   else if(input.mode!=='do'){if(body.contents[0].parts.length!==1)throw new Error('General question unexpectedly included a screen');result=none(input.history.length?'Example: Smartphones are ubiquitous today.':'Ubiquitous means present or found everywhere.');}
   else{
    const fields=input.current.controls;globalThis.taskProbe.push({text:input.current.text,fields:fields.filter(c=>c.actions.includes('type'))});
    const profile=input.personalContext.find(e=>e.title==='Form profile');if(!profile)throw new Error('Operator did not receive saved profile');const savedName=profile.text.match(/Name: (.+)/)[1],savedEmail=profile.text.match(/Email: (.+)/)[1];
    const name=fields.find(c=>c.name==='Full name'&&c.actions.includes('type')),email=fields.find(c=>c.name==='Email address'&&c.actions.includes('type'));
    if(!name||!email)throw new Error('Real form controls unavailable');
    if(name.value!==savedName)result={answer:'I’ll fill your name.',status:'continue',action:{type:'type',targetId:name.id,value:savedName}};
    else if(email.value!==savedEmail)result={answer:'I’ll fill your email.',status:'continue',action:{type:'type',targetId:email.id,value:savedEmail}};
    else if(input.current.text.includes('Submitted: Alex Builder'))result=none('The local practice form shows Submitted: Alex Builder.');
    else result={answer:'The details are filled. Review the submission.',status:'continue',action:{type:'click',targetId:fields.find(c=>c.name==='Submit registration').id,value:''}};
   }
   return{ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(result)}]}}]})};
  };});
  await page.locator('#task-screen').uncheck();await page.locator('#task-goal').fill('What does ubiquitous mean?');await page.locator('#task-send').click();
  await page.getByText('Ubiquitous means present or found everywhere.',{exact:true}).waitFor();await page.waitForFunction(()=>!taskRunning);
  await page.locator('#task-goal').fill('Use it in a sentence');await page.locator('#task-send').click();await page.getByText('Example: Smartphones are ubiquitous today.',{exact:true}).waitFor();await page.waitForFunction(()=>!taskRunning);
  console.log('PASS: general meanings without screen, direct answers and follow-up context.');
  await page.evaluate(async()=>{const preview=await api.previewContext('Name: Alex Builder\nEmail: alex@example.test');await api.importContext(preview.entries.map(e=>({...e,title:'Form profile',category:'profile',enabled:true})));});
  await page.locator('#task-demo').click();await page.waitForFunction(()=>document.getElementById('task-window').value!=='');
  await page.locator('#task-goal').fill('Fill this form with my saved name and email. Submit after I review it.');
  await page.locator('#task-send').click();
  try{await page.locator('#task-review').waitFor({state:'visible',timeout:60000});}catch(e){console.log(await page.locator('#task-status').innerText(),await page.locator('#task-answer').innerText(),JSON.stringify(await desktop.evaluate(()=>globalThis.taskProbe)));throw e;}
  assert.match(await page.locator('#task-review-fields').innerText(),/Alex Builder/);assert.equal(await page.locator('#task-log li[data-kind="action"]').count(),2);
  await page.locator('#task-approve').click();await page.getByText('The local practice form shows Submitted: Alex Builder.',{exact:true}).waitFor({timeout:30000});
  await page.waitForFunction(()=>!taskRunning);assert.equal(await page.locator('#task-log li[data-kind="action"]').count(),3);
  assert.equal(await page.locator('#task-log li[data-kind="check"].ledger-pass').count(),1,'the completion check is written to the visible log');
  assert.match(await page.locator('#task-meter').innerText(),/model requests/);
  fs.mkdirSync('test-results',{recursive:true});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'test-results/autonomous-task.png',fullPage:true});assert.deepEqual(errors,[]);
  console.log('PASS: imported profile → coordinator → operator with saved values → real native form changes → review → submission → verified confirmation.');
 }finally{await desktop.close();}
})().catch(e=>{console.error(e);process.exit(1);});
