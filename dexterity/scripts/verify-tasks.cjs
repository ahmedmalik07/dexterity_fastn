// Live AI test uses a general definition and the local native sample form only.
const{_electron:electron}=require('@playwright/test');const assert=require('node:assert/strict');
(async()=>{
 const env={...process.env,DEXTERITY_SETUP:'1'};delete env.ELECTRON_RUN_AS_NODE;delete env.DEXTERITY_TEST;
 const desktop=await electron.launch({args:['.'],env});let sampleMemoryId;
 try{
  await desktop.firstWindow();let page;
  for(let i=0;i<100;i++){page=desktop.windows().find(p=>p.url().endsWith('/index.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}
  await page.waitForFunction(()=>typeof prefs!=='undefined'&&prefs);await page.evaluate(()=>{prefs.voice=false;});
  await desktop.evaluate(()=>{const fetcher=globalThis.fetch;globalThis.taskProbe=[];globalThis.fetch=async(url,options)=>{const response=await fetcher(url,options);try{const body=JSON.parse(options.body),input=JSON.parse(body.contents[0].parts[0].text);if(input.mode==='do'){const data=await response.clone().json();globalThis.taskProbe.push({fields:input.current.controls.filter(c=>c.actions.includes('type')).map(c=>({name:c.name,value:c.value,id:c.id})),reply:data.candidates?.[0]?.content?.parts});}}catch{}return response;};});
  await page.locator('#task-screen').uncheck();await page.locator('#task-memory').uncheck();await page.locator('#task-goal').fill('What does ubiquitous mean? Give one everyday example.');await page.locator('#task-send').click();
  await page.waitForFunction(()=>!taskRunning,null,{timeout:50000});const definition=await page.locator('#task-answer').innerText();assert.match(definition,/everywhere|widespread|all places/i);console.log('PASS: live Gemini general definition and example.');
  await page.locator('#task-demo').click();await page.waitForFunction(()=>document.getElementById('task-window').value!=='');
  const currentContext=await page.evaluate(()=>api.context());if(currentContext.entries.some(e=>e.enabled))throw new Error('Live fixture requires no enabled personal memories, so it cannot accidentally upload existing user context.');
  const updated=await page.evaluate(()=>api.saveContext({title:'Live sample profile',category:'profile',text:'My name is Alex Builder and my email is alex@example.test.',enabled:true,source:'Generated live test fixture'}));sampleMemoryId=updated.entries.find(e=>e.title==='Live sample profile'&&!currentContext.entries.some(old=>old.id===e.id)).id;
  await page.locator('#task-memory').check();await page.locator('#task-goal').fill('Fill only the Full name and Email address fields using my saved name and email. Do not fill the password and do not submit. Finish when both fields show my saved values.');
  await page.locator('#task-send').click();await page.waitForFunction(()=>!taskRunning,null,{timeout:120000});
  const status=await page.locator('#task-status').innerText();if(!status.startsWith('Done'))throw new Error(await page.locator('#task-answer').innerText());
  const target=await page.locator('#task-window').inputValue();const form=await page.evaluate(id=>api.inspectForm(false,id),target);
  if(form.fields.find(f=>f.label==='Full name').value!=='Alex Builder'||form.fields.find(f=>f.label==='Email address').value!=='alex@example.test')console.log(JSON.stringify(await desktop.evaluate(()=>globalThis.taskProbe)));
  assert.equal(form.fields.find(f=>f.label==='Full name').value,'Alex Builder');assert.equal(form.fields.find(f=>f.label==='Email address').value,'alex@example.test');
  console.log('PASS: live Gemini coordinator, saved-context retrieval, operator and verifier completed native field changes with the correct saved values.');
 }finally{if(sampleMemoryId){const page=desktop.windows().find(p=>p.url().endsWith('/index.html'));await page.evaluate(async id=>{await api.stopTask();await api.removeContext(id);},sampleMemoryId).catch(()=>{});}await desktop.close();}
})().catch(error=>{console.error('Live task check failed:',error.message);process.exit(1);});
