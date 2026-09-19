document.querySelector('nav').insertAdjacentHTML('afterbegin','<button class="nav" id="assistant-nav" data-page="assistant"><span>✦</span>Ask Dexterity</button>');
document.querySelector('main').insertAdjacentHTML('afterbegin',`<section id="assistant" class="page" hidden>
 <div class="eyebrow">YOUR EVERYDAY DESKTOP ASSISTANT</div><h1>What would you like to get done?</h1><p class="subtitle">Ask a question. Learn something. Hand over a task.</p>
 <div class="task-callout"><strong>Call me from any app</strong><span>Hold <kbd>Ctrl</kbd> for 3 seconds · triple-click · click the cursor companion</span><small>Speak, then pause. Dexterity starts your task beside the cursor automatically. Press Escape to stop.</small></div>
 <form id="task-form" class="task-composer"><div class="task-modes" role="group" aria-label="How Dexterity should help"><label><input type="radio" name="task-mode" value="answer" checked><span>✦ Answer</span><small>Explain or understand</small></label><label><input type="radio" name="task-mode" value="teach"><span>◎ Teach me</span><small>Learn step by step</small></label><label><input type="radio" name="task-mode" value="do"><span>↗ Do it</span><small>Work through the task</small></label></div>
 <textarea id="task-goal" rows="3" maxlength="4000" placeholder="What does this word mean? • Explain this error • Fill this form with my name Alex and email alex@example.com" aria-label="Your task"></textarea>
 <div class="task-context-options"><label><input type="checkbox" id="task-screen" checked> Use my screen</label><select id="task-window" aria-label="Work in"><option value="">Work in the app behind Dexterity</option></select><button id="task-windows" class="text-button" type="button">Refresh apps</button></div>
 <div class="task-send-row"><small id="task-share-note">Starting shares the active screen, selected text and visible controls with your AI provider. Do it reads each updated screen.</small><button class="secondary" type="button" id="task-clear">New conversation</button><button class="primary" id="task-send">Ask Dexterity ↑</button><button class="secondary" id="task-stop" type="button" hidden>■ Stop</button></div></form>
 <div class="task-status" id="task-status" role="status">Ready. Use the examples below or ask in your own words.</div><div id="heard-review" class="heard-review" hidden><div class="heard-top"><strong>This is what I heard</strong><span id="voice-heard-count"></span></div><textarea id="voice-heard-text" rows="2" maxlength="4000" aria-label="What Dexterity heard"></textarea><div class="heard-actions"><button type="button" class="primary" id="voice-heard-run">Run this now &#8599;</button><button type="button" class="secondary" id="voice-heard-again">&#9679; Say it again</button><button type="button" class="text-button" id="voice-heard-cancel">Cancel</button></div><small>Correct any misheard word and the countdown stops. Add names you use often under Settings, Words Dexterity keeps mishearing.</small></div>
 <div id="task-result" hidden class="task-result"><div class="task-result-heading"><strong id="task-provider">Dexterity</strong><span id="task-target"></span></div><div class="task-meter" id="task-meter" hidden></div><div class="task-result-grid"><div><div id="task-answer"></div><div id="task-review" hidden><h3>Approve this action</h3><p id="task-review-text"></p><div id="task-review-fields"></div><button class="primary" id="task-approve">Approve this action & continue</button><small>This review expires shortly. Check the target app before approving.</small></div><button class="text-button" id="task-teach-next" hidden>I’ve done that — check my screen and continue →</button><div id="task-plan-view" hidden></div><div class="task-ledger-head" id="task-ledger-head" hidden>Action log &#183; every step Dexterity actually performed</div><ol id="task-log"></ol></div><div id="task-preview-panel"><img id="task-preview" alt="Screen Dexterity is working with"><p id="task-selection"></p></div></div></div>
 <details class="task-how" open><summary>How to use Dexterity for everyday work</summary><p><b>1.</b> Open what you need help with. <b>2.</b> Choose Answer, Teach me or Do it. <b>3.</b> Say your goal or type it here. Dexterity reads the screen automatically. <b>4.</b> Ask a follow-up in the same conversation.</p>
 <div class="task-examples"><button type="button" data-task-example="Explain the selected word or passage in context, with a simple example." data-task-mode="answer"><strong>Understand a word</strong><span>Select text in any supported app, then press Ctrl + Shift + E. Or say the word.</span></button><button type="button" data-task-example="Translate the visible text into English and explain its meaning." data-task-mode="answer"><strong>Translate or summarize</strong><span>“Summarize this page in three points.”</span></button><button type="button" data-task-example="Explain this error and give me the steps to fix it." data-task-mode="teach"><strong>Get unstuck</strong><span>Open the error, then ask what went wrong.</span></button><button type="button" data-task-example="Teach me how to use this app. Start with the first useful action and explain why." data-task-mode="teach"><strong>Learn a new app</strong><span>Follow a step, then choose “I’ve done that”.</span></button><button type="button" id="task-demo"><strong>Try real automation</strong><span>Open a local sample form, give Dexterity the details, and watch it fill them.</span></button><button type="button" data-task-example="Explain compound interest with a simple example." data-task-mode="answer" data-no-screen="true"><strong>Ask anything general</strong><span>Turn off Use my screen. Ask definitions, questions, or request writing help.</span></button></div>
 <p class="task-limits">Do it supports accessible text fields, buttons, links, selections, checkboxes, scrolling and opening web pages. Work in your current signed-in browser. <button type="button" class="text-button" id="task-browser">Open a tab in my browser</button> keeps that window’s session. Sign-in, passwords, CAPTCHA and unsupported controls need your help. Submission and destructive controls require review. There is no promise of control over every app.</p></details>
 </section>`);
let taskRunning=false,taskId=null,taskMode='answer';
function openAssistant(){showPage('assistant');$('page-label').textContent='Ask Dexterity';}
function chooseTaskMode(mode){document.querySelector(`input[name="task-mode"][value="${mode}"]`).checked=true;taskMode=mode;$('task-send').textContent=mode==='do'?'Start task ↗':mode==='teach'?'Teach me →':'Ask Dexterity ↑';}
function taskState(active){taskRunning=active;$('task-send').hidden=active;$('task-stop').hidden=!active;for(const id of ['task-goal','task-screen','task-window','task-clear'])$(id).disabled=active;document.querySelectorAll('[name="task-mode"]').forEach(el=>el.disabled=active);}
async function refreshTaskWindows(){try{const list=await api.listFormWindows(),value=$('task-window').value;$('task-window').replaceChildren(new Option('Work in the app behind Dexterity',''));for(const item of list)$('task-window').append(new Option(item.title,item.id));if(list.some(w=>w.id===value))$('task-window').value=value;}catch(e){toast(e.message);}}
async function startTask(goal,options={}){
 if(taskRunning)return toast('Stop the current task first.');
 if(!prefs?.hasAIKey){showPage('settings');return toast('Add an OpenAI or Gemini key first.');}
 if(!goal.trim())return toast('Tell Dexterity what you want to do.');
 openAssistant();speechSynthesis.cancel();$('task-goal').value=goal;
 $('task-screen').onchange();
 if(options.mode)chooseTaskMode(options.mode);
 const mode=document.querySelector('[name="task-mode"]:checked').value;taskMode=mode;
 taskState(true);$('task-review').hidden=true;$('task-teach-next').hidden=true;$('task-log').replaceChildren();$('task-answer').textContent='';$('task-result').hidden=false;resetTaskPanels();
 try{const result=await api.startTask({goal,mode,companion:mode==='teach'||options.companion===true,screen:$('task-screen').checked,useMemory:$('task-memory')?.checked!==false,windowId:options.windowId||(options.remembered?'':$('task-window').value),remembered:!!options.remembered});taskId=result.id;}
 catch(e){taskState(false);$('task-status').textContent=e.message;toast(e.message);}
}
$('task-form').onsubmit=e=>{e.preventDefault();startTask($('task-goal').value);};
document.querySelectorAll('[name="task-mode"]').forEach(el=>el.onchange=()=>chooseTaskMode(el.value));
$('task-stop').onclick=()=>api.stopTask();
$('task-clear').onclick=async()=>{try{await api.clearTask();$('task-goal').value='';$('task-answer').textContent='';$('task-result').hidden=true;toast('New conversation started.');}catch(e){toast(e.message);}};
$('task-approve').onclick=async()=>{const id=taskId;$('task-review').hidden=true;try{await api.approveTask(id);}catch(e){toast(e.message);}};
$('task-teach-next').onclick=async()=>{try{await api.nextLesson();}catch(e){toast(e.message);}};
$('task-windows').onclick=refreshTaskWindows;
$('assistant-nav').onclick=()=>{openAssistant();refreshTaskWindows();};
$('task-browser').onclick=async()=>{try{await api.openFormBrowser('https://www.google.com',$('task-window').value);toast('Opened in your existing browser session.');}catch(e){toast(e.message);}};
$('task-screen').onchange=()=>{$('task-share-note').textContent=$('task-screen').checked?'Starting shares the active screen, selected text and visible controls. Do it reads each updated screen.':'Only your question and recent conversation are sent. No screen is captured.';};
document.querySelectorAll('[data-task-example]').forEach(el=>el.onclick=()=>{if(taskRunning)return;openAssistant();chooseTaskMode(el.dataset.taskMode);$('task-goal').value=el.dataset.taskExample;$('task-screen').checked=el.dataset.noScreen!=='true';$('task-screen').onchange();$('task-goal').focus();});
$('task-demo').onclick=async()=>{if(taskRunning)return;try{await api.practiceForm();await refreshTaskWindows();const option=[...$('task-window').options].find(o=>o.text==='Dexterity practice form');if(option)$('task-window').value=option.value;chooseTaskMode('do');$('task-screen').checked=true;$('task-goal').value='Fill this practice form with name Alex Builder and email alex@example.test. Submit the registration after I review it.';openAssistant();toast('Ready. Press Start task and watch Dexterity work through the form.');}catch(e){toast(e.message);}};
api.onNative(event=>{
 if(event.type==='task-quick'){ $('task-screen').checked=true;startTask(event.goal,event);return; }
 if(event.type==='setup-required'){showPage('settings');return;}
 if(event.type==='task-start'){taskId=event.id;taskMode=event.mode;taskState(true);$('task-goal').value=event.goal;$('task-result').hidden=false;$('task-review').hidden=true;$('task-teach-next').hidden=true;$('task-log').replaceChildren();resetTaskPanels();$('task-status').textContent='Starting…';}
 if(event.type==='task-progress')$('task-status').textContent=event.message;
 if(event.type==='task-context'){$('task-target').textContent=event.title;$('task-preview-panel').hidden=!event.image;if(event.image)$('task-preview').src=event.image;$('task-selection').textContent=event.selectedText?'Selected: '+event.selectedText:'';}
 if(event.type==='task-answer'){$('task-answer').textContent=event.answer;$('task-provider').textContent=`${event.provider} · ${event.model}`;}
 if(event.type==='task-plan')renderTaskPlan(event.plan);
 if(event.type==='task-usage')renderMeter(event,false);
 if(event.type==='task-ledger')appendLedger(event);
 if(event.type==='task-review'){$('task-status').textContent='Waiting for your review';$('task-review').hidden=false;$('task-review-text').textContent=event.action==='type'?`Type “${event.value}” into “${event.label}” in the target app?`:`${event.action}: “${event.label}” in the target app?`; $('task-review-fields').replaceChildren();for(const field of event.fields){const p=document.createElement('p');p.textContent=field.name+': '+field.value;$('task-review-fields').append(p);} }
 if(event.type==='task-finished'){taskState(false);renderMeter(event,true);closeHeard();$('task-review').hidden=true;$('task-answer').textContent=event.answer;$('task-status').textContent=event.status==='done'?`Done · ${event.actions} actions performed`:event.status==='ask'?'Your input is needed':event.status==='stopped'?'Stopped':'Could not finish';$('task-teach-next').hidden=taskMode!=='teach'||event.status!=='done';if(!event.companion&&(event.status==='done'||event.status==='ask'))say(event.answer);}
});
// New requests and voice share the same task flow; the old capture page stays available.
$('start').onclick=openAssistant;$('setup-ai').onclick=openAssistant;
for(const id of ['demo','side-demo'])$(id).onclick=()=>{openAssistant();$('task-demo').click();};
document.querySelectorAll('[data-question]').forEach(el=>el.onclick=()=>{openAssistant();$('task-goal').value=el.dataset.question;chooseTaskMode('answer');});
openAssistant();refreshTaskWindows();

// ---- What Dexterity heard: a short, editable countdown before a spoken request runs ----
let heardTimer=null,heardOptions=null,heardLeft=0;
function closeHeard(){clearInterval(heardTimer);heardTimer=null;heardOptions=null;if($('heard-review'))$('heard-review').hidden=true;}
function stopHeardCountdown(){if(!heardTimer)return;clearInterval(heardTimer);heardTimer=null;$('voice-heard-count').textContent='Countdown stopped. Press Run this now when it looks right.';}
function runHeard(){const text=$('voice-heard-text').value.trim(),options=heardOptions||{};closeHeard();if(!text)return toast('There is nothing to run. Say it again.');if(options.conversation)api.askCompanion(text,{screen:true,currentScreen:true}).catch(e=>toast(e.message));else startTask(text,options);}
function reviewHeard(text,options={}){
 openAssistant();heardOptions=options;$('heard-review').hidden=false;$('voice-heard-text').value=text;
 if(options.mode)chooseTaskMode(options.mode);
 $('task-status').textContent='Check what I heard before it runs.';
 heardLeft=5;$('voice-heard-count').textContent=`Starting in ${heardLeft}s`;
 clearInterval(heardTimer);
 heardTimer=setInterval(()=>{heardLeft--;if(heardLeft<=0){clearInterval(heardTimer);heardTimer=null;runHeard();}else $('voice-heard-count').textContent=`Starting in ${heardLeft}s`;},1000);
 $('voice-heard-text').focus();$('voice-heard-text').select();
}
$('voice-heard-text').oninput=stopHeardCountdown;
$('voice-heard-run').onclick=runHeard;
$('voice-heard-cancel').onclick=()=>{closeHeard();$('task-status').textContent='Voice request cancelled. Nothing was run.';};
$('voice-heard-again').onclick=()=>{closeHeard();if(typeof talk==='function')talk();};

// ---- Plan, action ledger and the measured cost of each task ----
function resetTaskPanels(){$('task-plan-view').hidden=true;$('task-plan-view').replaceChildren();$('task-ledger-head').hidden=true;$('task-meter').hidden=true;$('task-meter').replaceChildren();}
function renderTaskPlan(plan){
 if(!plan)return;
 const view=$('task-plan-view');view.replaceChildren();view.hidden=false;
 const title=document.createElement('strong');title.textContent='Planned approach';
 const summary=document.createElement('p');summary.textContent=plan.summary;
 const list=document.createElement('ol');
 for(const step of plan.steps||[]){const li=document.createElement('li');li.textContent=step;list.append(li);}
 const success=document.createElement('p');success.className='plan-success';success.textContent='Done when: '+plan.success;
 view.append(title,summary,list,success);
}
function appendLedger(row){
 $('task-ledger-head').hidden=false;
 const li=document.createElement('li');li.className='ledger-'+(row.pass?'pass':'fail');li.dataset.kind=row.kind;
 const time=document.createElement('span');time.className='ledger-time';time.textContent=row.second+'s';
 const text=document.createElement('span');text.textContent=(row.kind==='check'?(row.pass?'✓ ':'✗ '):'')+row.message+(row.approved?' · you approved this':'');
 li.append(time,text);$('task-log').append(li);
}
function renderMeter(data,final){
 const meter=$('task-meter');meter.hidden=false;meter.replaceChildren();
 const parts=[`${(data.seconds||0).toFixed(1)}s`,`${data.requests||0} model ${data.requests===1?'request':'requests'}`];
 if(data.tokens)parts.push(`${(data.tokens.input+data.tokens.output).toLocaleString()} tokens`);
 parts.push(typeof data.cost==='number'?`≈ $${data.cost.toFixed(4)}${data.costPartial?'+':''}`:'cost rate not published for this model');
 if(data.model)parts.push(data.model);
 if(!final&&data.role)parts.push(data.role+' working');
 for(const part of parts){const chip=document.createElement('span');chip.textContent=part;meter.append(chip);}
 const note=document.createElement('small');note.textContent=final?'Measured for this task. Price estimated from the model’s published per-token rate.':'Running total';
 meter.append(note);
}
api.onNative(event=>{if(event.type==='cancel-review')closeHeard();});
