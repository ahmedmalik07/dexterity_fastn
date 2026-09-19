const { app, BrowserWindow, ipcMain, desktopCapturer, screen, globalShortcut, safeStorage, Menu, shell } = require('electron');
const { NativeBridge } = require('./native.cjs');
const path = require('node:path'), fs = require('node:fs');
const { toScreenPoint } = require('./core.cjs');
const { DEFAULT_MODEL, GEMINI_MODEL, ROUTER_MODEL, analyzeWithFallback } = require('./providers.cjs');
const { transcribeAudio } = require('./transcription.cjs');
const { randomUUID } = require('node:crypto');
const { TaskRunner } = require('./task-runner.cjs');
const {ContextStore}=require('./context-store.cjs');
const {coordinate}=require('./team.cjs');
const {registerContextIPC}=require('./context-ipc.cjs');
const {createCoach}=require('./coach.cjs');
const {conversationRequest}=require('./conversation.cjs');
const {BackgroundJobs}=require('./background-jobs.cjs');
const {VoiceConversation}=require('./voice-conversation.cjs');
const {ConversationHistory}=require('./conversation-history.cjs');
const {listFiles,previewFile}=require('./job-files.cjs');
let conversationHistory,conversationHistoryError;
let voiceConversation;
let backgroundJobs,backgroundJobsError;
// A build may ship a demo credential so the app works with no setup. It is only a default; a saved key replaces it.
let bundled={};try{bundled=require('./bundled-key.cjs');}catch{}
if (process.env.DEXTERITY_TEST) app.setPath('userData', path.join(app.getPath('temp'), 'dexterity-test-' + process.pid));
const background = !!(process.env.DEXTERITY_TEST || process.env.DEXTERITY_SETUP);
let main, orb, pointer, listeningWindow, native, followTimer, pointerTimer, capture, pending = false, orbHeld = false, isListening = false, formBusy = false, voiceStarting = false;
let voiceSession, quitting=false, taskRunner, contextStore, contextError, coach, coachWindow;
if(!background){if(!app.requestSingleInstanceLock()){app.quit();return;}app.on('second-instance',()=>{if(main&&!main.isDestroyed())dashboard();});}
let settings = { model: DEFAULT_MODEL, routerModel:ROUTER_MODEL,routerKey:'',voice: true, demo: false, key: '', geminiKey: '', speechMode:'auto', speechLanguage:'auto', speechPause:1200, speechVocabulary:'', voiceReview:false, ctrlActivation: true, tripleActivation: true, companion: true };
const prefs = () => path.join(app.getPath('userData'), 'preferences.json');
function publicSettings() { return { model: settings.model,routerModel:settings.routerModel,hasRouterKey:!!settings.routerKey,bundledRouterKey:!!bundled.routerKey&&settings.routerKey===bundled.routerKey, geminiModel:GEMINI_MODEL, voice: settings.voice, demo:false, speechMode:settings.speechMode,speechLanguage:settings.speechLanguage,speechPause:settings.speechPause,speechVocabulary:settings.speechVocabulary,voiceReview:settings.voiceReview,hasKey: !!settings.key, hasGeminiKey:!!settings.geminiKey, hasAIKey:!!(settings.routerKey||settings.key || settings.geminiKey), encrypted: safeStorage.isEncryptionAvailable(), ctrlActivation: settings.ctrlActivation, tripleActivation: settings.tripleActivation, companion: settings.companion }; }
function broadcast(event) { for(const window of [main, listeningWindow, coachWindow]) if(window && !window.isDestroyed()) window.webContents.send('native:event', event); }
function persistSettings() {
 const encryptedKey = settings.key && safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(settings.key).toString('base64') : undefined;
 const encryptedGeminiKey = settings.geminiKey && safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(settings.geminiKey).toString('base64') : undefined;
 const encryptedRouterKey=settings.routerKey&&safeStorage.isEncryptionAvailable()?safeStorage.encryptString(settings.routerKey).toString('base64'):undefined;
 fs.mkdirSync(app.getPath('userData'), { recursive: true });
 fs.writeFileSync(prefs(), JSON.stringify({model:settings.model,routerModel:settings.routerModel,encryptedRouterKey,voice: settings.voice, demo:false,speechMode:settings.speechMode,speechLanguage:settings.speechLanguage,speechPause:settings.speechPause,speechVocabulary:settings.speechVocabulary,voiceReview:settings.voiceReview,voiceVersion:2, ctrlActivation: settings.ctrlActivation, tripleActivation: settings.tripleActivation, companion: settings.companion, encryptedKey, encryptedGeminiKey }));
}
function setCompanion(enabled) {
 settings.companion = !!enabled; clearInterval(followTimer);
 if(!enabled) { orb.hide(); return false; }
 const move = () => { if(orbHeld || isListening) return; const p=screen.getCursorScreenPoint(), b=screen.getDisplayNearestPoint(p).workArea; const current=orb.getBounds(); if(p.x>=current.x && p.x<=current.x+48 && p.y>=current.y && p.y<=current.y+48) return; orb.setPosition(Math.max(b.x,Math.min(p.x+18,b.x+b.width-48)),Math.max(b.y,Math.min(p.y+18,b.y+b.height-48))); };
 move(); orb.showInactive(); followTimer=setInterval(move,120); return true;
}
async function startListening() {
 if(pending || formBusy || taskRunner?.run) throw new Error('Stop the current task with Escape before starting another voice request.');
 if(isListening || voiceStarting) return;
 voiceStarting=true;
 voiceConversation?.listening();
 coach?.hide();hidePointer();
 const b=screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
 const cursor=screen.getCursorScreenPoint();listeningWindow.setPosition(Math.max(b.x,Math.min(cursor.x+50,b.x+b.width-380)),Math.max(b.y,Math.min(cursor.y+25,b.y+b.height-260)));
 broadcast({type:'voice-starting'});
 try {
  if(settings.speechMode==='router'||settings.speechMode==='gemini' || (settings.speechMode==='auto' && (settings.routerKey||settings.geminiKey))) {
   // 'auto' prefers Gemini; OpenRouter is only chosen when there is no Gemini key.
   const engine=settings.speechMode==='router'||(settings.speechMode==='auto'&&!settings.geminiKey&&settings.routerKey)?'OpenRouter':'Gemini';
   if(engine==='OpenRouter'?!settings.routerKey:!settings.geminiKey)throw new Error('Add the selected voice provider key in Settings.');
   const session={id:randomUUID(),engine,status:'starting',controller:new AbortController()};voiceSession=session;isListening=true;
   session.timer=setTimeout(()=>endCloudVoice(session,'Microphone startup timed out. Try again.'),15000);
   await native.request('remember');
   if(voiceSession!==session)return;
   if(listeningWindow.webContents.isLoading())await new Promise(resolve=>listeningWindow.webContents.once('did-finish-load',resolve));
   if(voiceSession!==session)return;
   orb.hide();listeningWindow.showInactive();
   broadcast({type:'listening',active:true,engine,phase:'starting'});
   // 15s, not 45: if someone talks without a clear pause the recorder only stops at this
   // cap, and a 45 second wait with nothing happening reads as "it listened and did nothing".
   listeningWindow.webContents.send('voice:record',{id:session.id,pauseMs:settings.speechPause,engine,maxSeconds:15});
  }else await native.request('listen');
 }
 catch(e) { if(voiceSession)endCloudVoice(voiceSession,e.message);else broadcast({type:'native-error',error:e.message}); throw e; }
 finally { voiceStarting=false; }
}
function endCloudVoice(session,error) {
 if(voiceSession!==session)return;
 if(error)voiceConversation?.stop(error);
 clearTimeout(session.timer);session.controller.abort();voiceSession=null;isListening=false;
 if(!quitting && !listeningWindow.isDestroyed()) {listeningWindow.webContents.send('voice:cancel');listeningWindow.hide();}
 if(!quitting && settings.companion && !orb.isDestroyed())orb.showInactive();
 broadcast({type:'listening',active:false,error,engine:session.engine});
}
async function stopListening() {
 if(voiceSession) {endCloudVoice(voiceSession);return;}
 return native.request('stop');
}
function windowFor(options, file) {
 const win = new BrowserWindow({ icon: path.join(__dirname, '../ui/icon.png'), ...options, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true,backgroundThrottling:file!=='listening.html' } });
 win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
 win.webContents.on('will-navigate', e => e.preventDefault());
 win.loadFile(path.join(__dirname, '../ui', file)); return win;
}
function dashboard() { main.show(); main.focus(); }
function hidePointer() { clearTimeout(pointerTimer); pointer?.hide(); }
app.whenReady().then(() => {
 app.setAppUserModelId('app.dexterity.desktop');
 try {
  const file=fs.existsSync(prefs())?prefs():(!process.env.DEXTERITY_TEST?path.join(app.getPath('appData'),'clicky/preferences.json'):prefs());
  const s=JSON.parse(fs.readFileSync(file,'utf8'));
  settings={...settings,...s,key:'',geminiKey:'',routerKey:'',demo:false,speechPause:s.voiceVersion===2?s.speechPause:1200,model:(!s.model || s.model==='gpt-4o')?DEFAULT_MODEL:s.model};
  for(const [name,encrypted] of [['key',s.encryptedKey],['geminiKey',s.encryptedGeminiKey],['routerKey',s.encryptedRouterKey]]) {
   try{if(encrypted && safeStorage.isEncryptionAvailable())settings[name]=safeStorage.decryptString(Buffer.from(encrypted,'base64'));}catch{}
  }
 } catch {}
 if(!process.env.DEXTERITY_TEST&&!settings.geminiKey&&typeof bundled.geminiKey==='string'&&bundled.geminiKey.trim())settings.geminiKey=bundled.geminiKey.trim();
 if(!process.env.DEXTERITY_TEST&&!settings.routerKey&&typeof bundled.routerKey==='string'&&bundled.routerKey.trim())settings.routerKey=bundled.routerKey.trim();
 main = windowFor({ width: 1320, height: 880, minWidth: 1050, minHeight: 720, backgroundColor: '#f7f9fc', title: 'Dexterity — A little help, right here.', autoHideMenuBar: true, show: !background }, 'index.html');
 orb = windowFor({ width: 48, height: 48, frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true, resizable: false, show: false, focusable: false }, 'orb.html');
  pointer = windowFor({ width: 240, height: 110, frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true, resizable: false, show: false, focusable: false }, 'pointer.html');
 listeningWindow = windowFor({ width:380, height:260, frame:false, transparent:true, alwaysOnTop:true, skipTaskbar:true, resizable:false, show:false, focusable:false }, 'listening.html');
 coachWindow=windowFor({width:400,height:430,frame:false,transparent:true,alwaysOnTop:true,skipTaskbar:true,resizable:false,show:false},'coach.html');
 main.webContents.session.setPermissionRequestHandler((contents,permission,callback,details)=>callback(contents===listeningWindow.webContents && permission==='media' && !details.mediaTypes?.includes('video')));
 main.webContents.session.setPermissionCheckHandler((contents,permission,origin,details)=>contents===listeningWindow.webContents && permission==='media' && details.mediaType!=='video');
 native = new NativeBridge(app);
 voiceConversation=new VoiceConversation({listen:startListening,emit:broadcast,onExpire:()=>stopListening().catch(()=>{})});
 try{backgroundJobs=new BackgroundJobs({directory:path.join(app.getPath('userData'),'background-tasks'),encryption:safeStorage,emit:broadcast});}catch(error){backgroundJobsError=error.message;}
 try{contextStore=new ContextStore(app.getPath('userData'),safeStorage);}catch(error){contextError=error.message;}
 try{conversationHistory=new ConversationHistory(app.getPath('userData'),safeStorage);}catch(error){conversationHistoryError=error.message;}
 registerContextIPC({app,main,getStore:()=>{if(!contextStore)throw new Error(contextError||'Context is unavailable.');return contextStore;},busy:()=>!!taskRunner?.run});
 coach=createCoach({main,coach:coachWindow,pointer,native,broadcast,busy:()=>!!taskRunner?.run,hidePointer,startListening,ask:askCompanion,settings:()=>settings,voiceConversation});
 taskRunner=new TaskRunner({settings:()=>settings,read:readTaskContext,act:performTaskAction,coordinator:coordinate,memory:(goal,enabled)=>{if(enabled&&contextError)throw new Error(contextError+' Turn off Use my saved context to continue without it.');return contextStore?.retrieve(goal,enabled)||[];},record:(run,answer,status)=>contextStore?.record(run,answer,status),emit:event=>{broadcast(event);if(!quitting){coach.progress(event,taskRunner?.run);if(event.type==='task-review'){coach.hide();dashboard();}}},restore:(run,result)=>{if(!quitting){coach.finish(run,result);if(settings.companion)orb.showInactive();}}});
 const previousRecord=taskRunner.record;
 taskRunner.record=(run,answer,status)=>{previousRecord?.(run,answer,status);conversationHistory?.append(run,answer,status);broadcast({type:'conversation-history-changed'});};
 taskRunner.history=conversationHistory?.context()||[];
 native.on('event', event => {
  if(quitting)return;
  if(event.type==='ready') {
   native.request('configure', { ctrl: !background && settings.ctrlActivation, triple: !background && settings.tripleActivation }).catch(()=>{});
  }
  if(event.type==='activate') { startListening().catch(()=>{}); return; }
  if(event.type==='cancel-listening') { voiceConversation.stop();stopListening().catch(()=>{}); return; }
  if(voiceSession && ['listening','transcript','partial','audio-level'].includes(event.type))return;
  if(event.type==='listening') { event.engine='Windows offline'; isListening=event.active; if(isListening) { orb.hide(); listeningWindow.showInactive(); } else { listeningWindow.hide(); if(settings.companion) orb.showInactive(); } }
  if(event.type==='transcript') { listeningWindow.hide(); native.request('stop').catch(()=>{}); }
  broadcast(event);
 });
 if(!background) orb.webContents.once('did-finish-load',()=>setCompanion(settings.companion));
 pointer.setIgnoreMouseEvents(true);main.on('close',event=>{if(!quitting&&!background&&settings.companion){event.preventDefault();main.hide();}}); main.on('closed', () => app.quit());
 globalShortcut.register('CommandOrControl+Shift+Space', async () => {if(native.ready)await native.request('remember').catch(()=>{});coach.open();});
 globalShortcut.register('CommandOrControl+Shift+E',async()=>{if(taskRunner.run)return;await native.request('remember').catch(()=>{});broadcast({type:'task-quick',goal:'Explain the selected word or passage in context. If no text is selected, explain the text nearest my cursor if clear, otherwise ask which word I mean.',mode:'answer',remembered:true,companion:true});});
 globalShortcut.register('Escape', () => { voiceConversation.stop();taskRunner?.stop();if(isListening) stopListening().catch(()=>{});coach?.hide();hidePointer();broadcast({type:'cancel-review'}); });
});
app.on('before-quit',()=>{quitting=true;voiceConversation?.stop();backgroundJobs?.close();});
app.on('will-quit', () => { quitting=true;taskRunner?.stop();coach?.dispose();if(voiceSession)endCloudVoice(voiceSession);globalShortcut.unregisterAll(); clearInterval(followTimer); clearTimeout(pointerTimer); native?.close(); });
ipcMain.handle('settings:get', publicSettings);
ipcMain.handle('settings:save', (_, v) => {
 if(taskRunner?.run)throw new Error('Stop the current task before changing settings.');
 if(isListening)throw new Error('Finish or cancel listening before changing settings.');
 if (!v || typeof v.model !== 'string' || !/^[a-zA-Z0-9._-]{1,80}$/.test(v.model)) throw new Error('Enter a valid model name.');
 settings.model = v.model; settings.voice = !!v.voice; settings.demo = false;
 if(typeof v.routerModel==='string'&&/^[a-zA-Z0-9/._:-]{1,120}$/.test(v.routerModel))settings.routerModel=v.routerModel;
 if(v.removeRouterKey)settings.routerKey='';else if(typeof v.routerKey==='string'&&v.routerKey.trim())settings.routerKey=v.routerKey.trim();
 if(['auto','router','gemini','offline'].includes(v.speechMode))settings.speechMode=v.speechMode;
 if(['auto','en','ur-en'].includes(v.speechLanguage))settings.speechLanguage=v.speechLanguage;
 if([800,1200,2000,2500,4000].includes(v.speechPause))settings.speechPause=v.speechPause;
 if(typeof v.speechVocabulary==='string')settings.speechVocabulary=v.speechVocabulary.slice(0,1200);
 if(typeof v.voiceReview==='boolean')settings.voiceReview=v.voiceReview;
 if(typeof v.ctrlActivation==='boolean') settings.ctrlActivation=v.ctrlActivation;
 if(typeof v.tripleActivation==='boolean') settings.tripleActivation=v.tripleActivation;
 if (v.removeKey) settings.key = ''; else if (typeof v.key === 'string' && v.key.trim()) settings.key = v.key.trim();
 if (v.removeGeminiKey) settings.geminiKey = ''; else if (typeof v.geminiKey === 'string' && v.geminiKey.trim()) settings.geminiKey = v.geminiKey.trim().replace(/\\_/g,'_');
 persistSettings();
 native.request('configure',{ctrl:!background && settings.ctrlActivation,triple:!background && settings.tripleActivation}).catch(()=>{});
 return publicSettings();
});
const hireloop = require('./hireloop.cjs');
const publisher = require('./publish.cjs');

// --- Publish module: draft from the screen, then post everywhere through Fastn ---
ipcMain.handle('publish:from-screen', async (_, options = {}) => {
 if (!capture) throw new Error('Capture your screen first.');
 return publisher.draftFromScreen({ userDataDir: app.getPath('userData'), image: capture.image, note: options.note });
});
ipcMain.handle('publish:generate', (_, oneLiner) =>
 publisher.generate({ userDataDir: app.getPath('userData'), oneLiner }));
ipcMain.handle('publish:send', async (_, draft = {}) => {
 const result = await publisher.publish({ userDataDir: app.getPath('userData'), ...draft });
 return { ...result, message: publisher.describe(result) };
});


// --- HireLoop bridge (isolated: its own config file, no Dexterity settings touched) ---
ipcMain.handle('hireloop:config', () => hireloop.readConfig(app.getPath('userData')));
ipcMain.handle('hireloop:save-config', (_, input) => hireloop.writeConfig(app.getPath('userData'), input));
ipcMain.handle('hireloop:send', async (_, options = {}) => {
 if (!capture) throw new Error('Capture your screen first.');
 const result = await hireloop.sendCapture({
  userDataDir: app.getPath('userData'),
  image: capture.image,
  note: options.note,
  jobId: options.jobId,
  commit: options.commit !== false,
 });
 return { ...result, message: hireloop.describe(result) };
});

ipcMain.handle('capture', async () => {
 if(taskRunner?.run)throw new Error('Stop the current task before taking another capture.');
 if (pending || formBusy || isListening) throw new Error('Finish the current request or stop listening before capturing.');
 const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()), wasOrb = orb.isVisible();
 main.hide(); orb.hide(); hidePointer();
 try {
  await new Promise(r => setTimeout(r, 300));
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1600, height: 1000 } });
  const source = sources.find(s => s.display_id === String(display.id));
  if (!source || source.thumbnail.isEmpty()) throw new Error('Could not capture this display. Move Dexterity to your main screen and try again.');
  capture = { image: source.thumbnail.toDataURL(), bounds: display.bounds, displayId: display.id, timestamp: Date.now() };
  return { image: capture.image, name: source.name, timestamp: capture.timestamp };
 } finally { dashboard(); if (wasOrb) orb.showInactive(); }
});
ipcMain.handle('capture:clear', () => { capture = null; hidePointer(); });
ipcMain.handle('analyze', async (_, question) => {
 if(taskRunner?.run)throw new Error('A task is already running.');
 if (pending || formBusy || isListening) throw new Error('Finish the current request or stop listening before asking.');
 if (typeof question !== 'string' || !question.trim() || question.length > 4000) throw new Error('Enter a question under 4,000 characters.');
 if (!settings.routerKey&&!settings.key && !settings.geminiKey) throw new Error('Add an OpenRouter, OpenAI or Gemini API key in Settings first.');
 if (!capture) throw new Error('Capture your screen first.');
 pending = true;
 try {
  return await analyzeWithFallback(settings, question, capture.image);
 } catch (e) { if (e.name === 'TimeoutError') throw new Error('The request took too long. Please retry.'); throw e; }
 finally { pending = false; }
});
ipcMain.handle('dashboard', dashboard);
ipcMain.handle('companion', (_, enabled) => {
 const result=setCompanion(enabled); persistSettings(); return result;
});
ipcMain.on('companion:hold', (_, held) => { orbHeld=!!held; });
ipcMain.handle('orb:menu',()=>{Menu.buildFromTemplate([
 {label:'Talk to Dexterity',click:()=>startListening().catch(()=>dashboard())},
 {label:'Type a question',click:async()=>{if(native.ready)await native.request('remember').catch(()=>{});coach.open();}},
 {label:'Send screen to HireLoop',click:async()=>{
  try{
   if(!capture)await main.webContents.executeJavaScript('window.dexterity?.capture?.()').catch(()=>{});
   const result=await hireloop.sendCapture({userDataDir:app.getPath('userData'),image:capture?.image,commit:true});
   broadcast({type:'hireloop',message:hireloop.describe(result)});
  }catch(error){broadcast({type:'hireloop',message:error.message});}
 }},
 {label:'Open dashboard',click:dashboard},
 {label:'Hide companion',click:()=>{setCompanion(false);persistSettings();broadcast({type:'companion',enabled:false});}},
 {type:'separator'},{label:'Quit Dexterity',click:()=>app.quit()}
]).popup({window:orb});
 // popup() hands back the Menu, which cannot be structured-cloned across IPC, so this
 // handler returns nothing — otherwise right-clicking the orb throws.
});
ipcMain.handle('voice:start',startListening);
ipcMain.handle('voice:stop',()=>{voiceConversation.stop();return stopListening();});
ipcMain.handle('voice:conversation',(_,enabled)=>{if(!enabled){voiceConversation.stop();return stopListening();}if(isListening||taskRunner?.run)throw new Error('Finish the current request before starting hands-free.');if(settings.speechMode==='offline'||(!settings.routerKey&&!settings.geminiKey))throw new Error('Connect OpenRouter or Gemini and select cloud voice for hands-free conversation.');return voiceConversation.start();});
ipcMain.handle('voice:conversation-state',()=>voiceConversation.state());
ipcMain.handle('voice:reply-done',(event,token)=>event.sender===coachWindow.webContents?voiceConversation.heardReply(token):false);
ipcMain.handle('voice:finish',()=>{if(voiceSession?.status==='recording')listeningWindow.webContents.send('voice:finish');});
ipcMain.handle('voice:ready',(event,id)=>{
 if(event.sender!==listeningWindow.webContents || voiceSession?.id!==id)return;
 voiceSession.status='recording';clearTimeout(voiceSession.timer);const session=voiceSession;
 session.timer=setTimeout(()=>{if(voiceSession!==session)return;listeningWindow.webContents.send('voice:finish');session.timer=setTimeout(()=>endCloudVoice(session,'Recording stopped at the time limit. Try a shorter request.'),2500);},45000);
 broadcast({type:'listening',active:true,engine:voiceSession.engine,phase:'recording'});
});
ipcMain.handle('voice:recorder-error',(event,data)=>{
 if(event.sender!==listeningWindow.webContents || voiceSession?.id!==data?.id)return;
 endCloudVoice(voiceSession,String(data.message).slice(0,200));
});
ipcMain.handle('voice:audio',async(event,data)=>{
 const session=voiceSession;
 if(event.sender!==listeningWindow.webContents || !session || session.id!==data?.id || session.status!=='recording')return;
 session.status='transcribing';clearTimeout(session.timer);
 voiceConversation.thinking();
 session.timer=setTimeout(()=>endCloudVoice(session,'Transcription took too long. Please try again.'),35000);
 broadcast({type:'voice-transcribing',engine:session.engine});
 try {
  if(!(data.audio instanceof ArrayBuffer))throw new Error('Invalid microphone recording.');
  const result=await transcribeAudio({key:settings.geminiKey,routerKey:session.engine==='OpenRouter'?settings.routerKey:undefined,audio:data.audio,mimeType:data.mimeType,language:settings.speechLanguage,vocabulary:settings.speechVocabulary,signal:session.controller.signal});
  if(voiceSession!==session)return;
  endCloudVoice(session);
  if(!result.text){voiceConversation.stop('No clear speech heard. Microphone off.');return broadcast({type:'native-error',error:'No clear speech heard. Try again and speak a little closer to the microphone.'});}
  const review=settings.voiceReview&&!voiceConversation.state().active;
  if(review)dashboard();
  broadcast({type:'transcript',...result,review});
 }catch(error){if(voiceSession===session)endCloudVoice(session,error.message);}
});
ipcMain.handle('native:health',async()=>({...await native.request('health'),listening:isListening,speechEngine:settings.speechMode!=='offline'&&settings.routerKey?'OpenRouter':settings.speechMode!=='offline'&&settings.geminiKey?'Gemini':'Windows offline'}));
ipcMain.handle('form:practice',()=>native.practice());
ipcMain.handle('form:windows',()=>native.request('windows'));
async function openFormBrowser(input,windowId=''){
 let url='https://www.google.com/';
 if(typeof input==='string' && input.trim()) {
  let parsed;try{parsed=new URL(input.trim());}catch{throw new Error('Enter a complete website address starting with https://.');}
  if(!['https:','http:'].includes(parsed.protocol) || parsed.username || parsed.password)throw new Error('Use an http or https website address without embedded credentials.');
  url=parsed.href;
 }
 main.hide();orb.hide();coach?.hide();
 try{await new Promise(resolve=>setTimeout(resolve,250));return await native.request('browser-url',{url,windowId:String(windowId||'')});}
 catch(error){dashboard();throw error;}
}
ipcMain.handle('form:browser',(_,input)=>{if(taskRunner?.run)throw new Error('Stop the current task first.');return typeof input==='string'?openFormBrowser(input):openFormBrowser(input?.url,input?.windowId);});
ipcMain.handle('speech:settings',()=>shell.openExternal('ms-settings:privacy-microphone'));
ipcMain.handle('form:inspect',async (_,options={})=>{
 if(taskRunner?.run)throw new Error('Stop the current task first.');
 if(pending || formBusy) throw new Error('Finish the current request first.');
 formBusy=true;
 try {
  await stopListening(); main.hide(); orb.hide(); listeningWindow.hide();
  await new Promise(r=>setTimeout(r,400));
  return await native.request('inspect',{remembered:!!options.remembered,windowId:typeof options.windowId==='string'?options.windowId:''});
 } finally { formBusy=false; dashboard(); if(settings.companion) orb.showInactive(); }
});
ipcMain.handle('form:fill',async (_,data)=>{
 if(taskRunner?.run)throw new Error('Stop the current task first.');
 if(formBusy || pending || isListening) throw new Error('Finish the current request first.');
 if(!data || typeof data.token!=='string' || !data.values || typeof data.values!=='object' || Array.isArray(data.values)) throw new Error('Inspect a form and enter its field values first.');
 if(Object.values(data.values).some(v=>typeof v!=='string' || v.length>10000)) throw new Error('Invalid field value.');
 formBusy=true;
 try { return await native.request('fill',{token:data.token,values:data.values}); }
 finally { formBusy=false; }
});
ipcMain.handle('form:submit',async (_,data)=>{
 if(taskRunner?.run)throw new Error('Stop the current task first.');
 if(formBusy || pending || isListening) throw new Error('Finish the current request first.');
 if(!data || data.confirmed!==true || typeof data.buttonId!=='string' || typeof data.token!=='string') throw new Error('Review the filled form and confirm its submission.');
 formBusy=true;
 try { return await native.request('submit',{token:data.token,buttonId:data.buttonId,confirmed:true}); }
 finally { formBusy=false; }
});
ipcMain.handle('point', (_, step) => {
 if (!capture || Date.now() - capture.timestamp > 180000) throw new Error('Capture a fresh screen before pointing.');
 const display = screen.getAllDisplays().find(d => d.id === capture.displayId);
 if (!display || JSON.stringify(display.bounds) !== JSON.stringify(capture.bounds)) throw new Error('Your display changed. Capture a fresh screen.');
 const p = toScreenPoint(step, capture.bounds); if (!p) throw new Error('This step has no visible target.');
 hidePointer(); const b = capture.bounds;
 const left = Math.max(b.x, Math.min(p.x - 30, b.x + b.width - 240)), top = Math.max(b.y, Math.min(p.y - 30, b.y + b.height - 110));
 pointer.setBounds({x:left,y:top,width:240,height:110}); pointer.webContents.send('point:data', { x: p.x - left, y: p.y - top, title: String(step.title).slice(0, 65) });
 main.hide(); pointer.showInactive(); pointerTimer = setTimeout(() => { hidePointer(); dashboard(); }, 5000); return true;
});
ipcMain.handle('point:hide', () => { hidePointer(); dashboard(); });
async function readTaskContext(run){
 main.hide();orb.hide();hidePointer();listeningWindow.hide();coach?.hide();
 try{
  await new Promise(resolve=>setTimeout(resolve,300));
  let context;
  try{context=await native.request('context',{windowId:run.windowId,remembered:run.remembered});}
  catch(error){
   if(run.mode==='do')throw new Error('Could not read the target app: '+error.message);
   context={title:'Current screen',text:'Accessibility controls unavailable. Use the image to explain; ask for a supported target app if an action needs a control.',selectedText:'',controls:[],scrollable:false};
  }
  if(run.controller.signal.aborted)throw new Error('Stopped.');
  await new Promise(resolve=>setTimeout(resolve,250));
  const point=screen.getCursorScreenPoint();
  const display=context.bounds?.width>0?screen.getDisplayMatching({x:Math.round(context.bounds.x),y:Math.round(context.bounds.y),width:Math.round(context.bounds.width),height:Math.round(context.bounds.height)}):screen.getDisplayNearestPoint(point);
  const windows=context.windowId?await desktopCapturer.getSources({types:['window'],thumbnailSize:{width:1600,height:1000}}):[];
  let source=windows.find(s=>s.id.split(':')[1]===context.windowId),windowCapture=!!source&&!source.thumbnail.isEmpty();
  if(!source || source.thumbnail.isEmpty()){
   const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:1600,height:1000}});
   source=sources.find(s=>s.display_id===String(display.id));
  }
  if(!source||source.thumbnail.isEmpty())throw new Error('Could not capture the screen.');
  context.image=source.thumbnail.toDataURL();
  if(windowCapture&&context.bounds){const b=context.bounds,a=screen.screenToDipPoint({x:Math.round(b.x),y:Math.round(b.y)}),z=screen.screenToDipPoint({x:Math.round(b.x+b.width),y:Math.round(b.y+b.height)});context.captureBounds={x:a.x,y:a.y,width:z.x-a.x,height:z.y-a.y};}else context.captureBounds=display.bounds;
  context.capturedAt=Date.now();
  return context;
 }finally{if(!quitting&&!run.companion)dashboard();}
}
async function performTaskAction(action,context,confirmed){
 if(taskRunner.run?.controller.signal.aborted||!taskRunner.run)throw new Error('Stopped.');
 main.hide();orb.hide();
 if(action.type==='open_url') {const result=await openFormBrowser(action.value,context.windowId);await new Promise(resolve=>setTimeout(resolve,1500));return result;}
 await native.request('act',{token:context.token,...action,confirmed});
 await new Promise(resolve=>setTimeout(resolve,450));
}
ipcMain.handle('task:start',(_,input)=>{
 if(pending||formBusy||isListening)throw new Error('Finish the current request first.');
 if(!settings.routerKey&&!settings.key&&!settings.geminiKey)throw new Error('Add an OpenRouter, OpenAI or Gemini key in Settings first.');
 return taskRunner.start(input);
});
ipcMain.handle('task:stop',()=>taskRunner.stop());
ipcMain.handle('task:approve',(_,id)=>taskRunner.approve(id));
ipcMain.handle('task:clear',()=>{if(taskRunner.run)throw new Error('Stop the task first.');conversationHistory?.fresh();taskRunner.history=[];coach.reset();broadcast({type:'conversation-history-changed'});return true;});
async function askCompanion(text, options={}) {
 const delegated=typeof text==='string'&&/^(?:(?:hey[ ,]*)?dexterity[ ,]*)?agent\b[,: ]*(.*)$/is.exec(text.trim());
 if(delegated){const job=jobs().start(delegated[1]);coach.background(job);return{id:job.id,background:true};}
 if(pending||formBusy||isListening||taskRunner?.run)throw new Error('Finish or stop the current request first.');
 if(!settings.routerKey&&!settings.key&&!settings.geminiKey){dashboard();broadcast({type:'setup-required'});throw new Error('Connect an AI provider in Settings to start talking.');}
 const previous=options.fresh?null:(coach?.conversation()||conversationHistory?.anchor());
 const input=conversationRequest(text,previous);
 if(typeof options.screen==='boolean')input.screen=options.screen;
 // A new voice activation remembers the app the user is currently looking at.
 if(options.currentScreen){input.windowId='';input.remembered=true;}
 if(input.rootGoal!==input.goal)input.goal='Continue this lesson: '+input.rootGoal.slice(0,2000)+'\n'+input.goal;
 return taskRunner.start(input);
}
ipcMain.handle('companion:ask',(_,text,options)=>askCompanion(text,options));
ipcMain.handle('companion:chat',async()=>{if(native.ready)await native.request('remember').catch(()=>{});coach.open();return true;});
function jobs(){if(!backgroundJobs)throw new Error(backgroundJobsError||'Background tasks are unavailable.');return backgroundJobs;}
ipcMain.handle('jobs:list',()=>({jobs:jobs().list(),...jobs().health()}));
ipcMain.handle('jobs:start',(_,goal,id)=>jobs().start(goal,id));
ipcMain.handle('jobs:stop',(_,id)=>jobs().stop(id));
ipcMain.handle('jobs:folder',async(_,id)=>{const error=await shell.openPath(jobs().folder(id));if(error)throw new Error(error);return true;});
ipcMain.handle('jobs:files',(_,id)=>listFiles(jobs().folder(id)));
ipcMain.handle('jobs:preview',(_,id,name)=>previewFile(jobs().folder(id),name));
function history(){if(!conversationHistory)throw new Error(conversationHistoryError||'Conversation history is unavailable.');return conversationHistory;}
ipcMain.handle('conversations:list',()=>history().state());
ipcMain.handle('conversations:configure',(_,enabled)=>history().configure(enabled));
ipcMain.handle('conversations:select',(_,id)=>{if(taskRunner.run||isListening)throw new Error('Finish the current request before switching conversations.');const chat=history().select(id);taskRunner.history=history().context();coach.restoreConversation(chat);return chat;});
ipcMain.handle('conversations:remove',(_,id)=>{if(taskRunner.run)throw new Error('Finish the current request first.');const current=history().current()?.id===id;const state=history().remove(id);if(current){taskRunner.history=[];coach.reset();}return state;});
