const {_electron:electron,chromium}=require('@playwright/test');
const assert=require('node:assert/strict'),http=require('node:http'),path=require('node:path');
(async()=>{
 const server=http.createServer((req,res)=>{
  res.setHeader('Content-Type','text/html');
  if(req.url==='/start')res.setHeader('Set-Cookie','dexterity_demo_session=existing; HttpOnly; SameSite=Lax; Path=/');
  const signedIn=(req.headers.cookie||'').includes('dexterity_demo_session=existing');
  res.end(`<title>Dexterity Existing Session Test</title><h1>${req.url==='/start'?'Original tab':signedIn?'Existing demo session preserved':'No session'}</h1><label>Full name<input aria-label="Full name" id="name"></label><p id="result"></p>`);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 // This owned browser has only a generated local session; no real user cookies are read.
 // No forced-accessibility flag: exercise an already-open browser as it stands.
 const browser=await chromium.launch({channel:'chrome',headless:false});let app;
 try{
  const original=await browser.newPage();await original.goto(origin+'/start');
  const env={...process.env,DEXTERITY_TEST:'1'};delete env.ELECTRON_RUN_AS_NODE;
  app=await electron.launch({...(process.env.DEXTERITY_PACKAGED?{executablePath:path.resolve('release-v1.7/win-unpacked/Dexterity.exe')}:{}),args:process.env.DEXTERITY_PACKAGED?[]:['.'],env});
  await app.firstWindow();let page;
  for(let i=0;i<100;i++){page=app.windows().find(p=>p.url().endsWith('/index.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}
  await page.waitForFunction(()=>typeof prefs!=='undefined'&&prefs);
  const windows=await page.evaluate(()=>api.listFormWindows()),target=windows.find(w=>w.title.startsWith('Dexterity Existing Session Test'));assert.ok(target);
  for(const url of ['javascript:alert(1)','file:///C:/secret','https://user:password@example.test/'])await assert.rejects(()=>page.evaluate(({url,id})=>api.openFormBrowser(url,id),{url,id:target.id}),/http|credentials/);
  assert.equal(original.context().pages().length,1);
  const nextTab=original.context().waitForEvent('page');
  const url=origin+'/signed-in?q=%2B%5E%25%7Btest%7D';
  const result=await page.evaluate(({url,id})=>api.openFormBrowser(url,id),{url,id:target.id});
  const next=await nextTab;await next.waitForURL(url);await next.getByText('Existing demo session preserved',{exact:true}).waitFor();
  assert.equal(result.windowId,target.id);assert.equal(result.session,'existing');assert.equal(original.url(),origin+'/start');assert.equal(original.context().pages().length,2);
  const snapshot=await page.evaluate(id=>api.inspectForm(false,id),target.id),name=snapshot.fields.find(f=>f.label==='Full name');assert.ok(name,'existing browser exposes the page field');
  await page.evaluate(({token,id})=>api.fillForm({token,values:{[id]:'Existing Session Builder'}}),{token:snapshot.token,id:name.id});
  assert.equal(await next.locator('#name').inputValue(),'Existing Session Builder');
  console.log('PASS: new tab in the exact existing browser window, generated session cookie preserved, original tab retained, real field filled without a new profile.');
  await page.evaluate(()=>api.practiceForm());
  const form=(await page.evaluate(()=>api.listFormWindows())).find(w=>w.title==='Dexterity practice form');assert.ok(form);
  await assert.rejects(()=>page.evaluate(({url,id})=>api.openFormBrowser(url,id),{url,id:form.id}),/existing signed-in browser/);
  assert.equal(original.context().pages().length,2);
  console.log('PASS: invalid URLs and non-browser targets fail without launching a fallback browser session.');
 }finally{if(app)await app.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
