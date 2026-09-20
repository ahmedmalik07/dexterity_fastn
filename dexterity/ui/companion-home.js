// The companion is the product entry point. Legacy automation stays out of this flow.
document.querySelector('.version').textContent='DESKTOP v1.9';
document.querySelectorAll('nav .nav').forEach(el=>{el.hidden=el.dataset.page==='home';});
const companionNav=document.createElement('button');companionNav.className='nav';companionNav.dataset.page='companion-home';companionNav.textContent='✦   Your companion';document.querySelector('nav').prepend(companionNav);
document.querySelector('main').insertAdjacentHTML('afterbegin',`<section id="companion-home" class="page">
 <div class="companion-intro"><div class="eyebrow">A LITTLE COMPANY. A LOT OF POSSIBILITY.</div><h1>Right here.<br>With you.</h1><p>Talk about what’s on your screen.<br>Get unstuck, learn a tool, follow a thought.</p><div class="companion-character"><img src="cursor-mark.svg" alt="Dexterity"><span>what are we making today?</span></div></div>
 <div class="companion-launch"><button class="primary" id="home-talk">● Let’s talk</button><button class="secondary" id="home-type">Type instead ↗</button><span>Or hold <kbd>Ctrl</kbd> for 3 seconds, anywhere.</span></div>
 <div class="companion-launch"><button class="ghost" id="home-companion" aria-pressed="true">Floating companion</button><span id="home-companion-note">Sits beside your cursor. Click it to talk.</span></div>
 <div id="connection-note" role="status"></div>
 <div class="companion-ideas"><button data-companion-prompt="Explain what I am looking at in simple terms."><span>01 / UNDERSTAND</span><strong>“What am I looking at?”</strong><p>Your screen becomes the context.</p></button><button data-companion-prompt="Teach me how to use this app. Start with one useful step and show me where."><span>02 / LEARN</span><strong>“Show me how this works.”</strong><p>A next step, right on your screen.</p></button><button data-companion-prompt="Help me understand this error and what I should try next."><span>03 / GET UNSTUCK</span><strong>“Why is this happening?”</strong><p>Work through it together.</p></button></div>
 <div class="companion-footnote"><strong>Your screen, when you ask.</strong><p>Screen context is shared with your connected AI only for a request. The microphone turns on when you activate it. Switch off “See my screen” in the companion for a general conversation.</p></div>
 </section>`);
function openCompanionHome(){showPage('companion-home');$('page-label').textContent='Your companion';}
companionNav.onclick=openCompanionHome;
$('home-talk').onclick=()=>talk();$('home-type').onclick=()=>api.openCompanion().catch(e=>toast(e.message));
document.querySelectorAll('[data-companion-prompt]').forEach(el=>el.onclick=async()=>{try{await api.openCompanion();await api.askCompanion(el.dataset.companionPrompt,{fresh:true,screen:true});}catch(e){toast(e.message);}});
function connectionNote(){if(!prefs)return;const note=$('connection-note');note.replaceChildren();if(prefs.hasAIKey){note.textContent='Connected · Ready when you are';note.className='connected';}else{note.textContent='Connect an AI provider once to get started. ';const button=document.createElement('button');button.textContent='Open settings →';button.className='text-button';button.onclick=()=>showPage('settings');note.append(button);}}
document.addEventListener('prefs-loaded',connectionNote);connectionNote();
openCompanionHome();
for(const id of ['side-demo','demo'])if($(id))$(id).hidden=true;
const jobsNav=document.createElement('button');jobsNav.className='nav';jobsNav.dataset.page='background-tasks';jobsNav.textContent='↗   Background tasks';companionNav.after(jobsNav);
document.querySelector('main').insertAdjacentHTML('beforeend',`<section id="background-tasks" class="page" hidden><div class="eyebrow">KEEP DOING YOUR THING.</div><h1>Hand a thought over.</h1><p class="subtitle">Research a topic. Build something. Get a useful file back.</p><p id="agent-connection" role="status">Checking your agent connection…</p><form id="background-form"><textarea id="background-goal" maxlength="4000" rows="3" required placeholder="Build me a simple countdown timer I can open in my browser…" aria-label="Background task"></textarea><div class="background-submit"><small>Or say “Dexterity agent” followed by your request.<br>Uses your signed-in Codex runtime. Each task gets its own local folder.</small><button class="primary">Start in background ↗</button></div></form><div id="background-list"></div></section>`);
let jobRecords=[];
function renderJobs(){
 const list=$('background-list');list.replaceChildren();jobsNav.textContent='↗   Background tasks'+(jobRecords.some(j=>j.status==='running')?' · working':'');
 if(!jobRecords.length){const p=document.createElement('p');p.className='jobs-empty';p.textContent='Your results will land here. Keep using your computer while an agent works.';list.append(p);}
 for(const job of jobRecords){
  const card=document.createElement('article');card.className='background-card';
  const status=document.createElement('small');status.textContent=job.status.toUpperCase();status.className='job-status '+job.status;
  const title=document.createElement('h3');title.textContent=job.goal;
  const progress=document.createElement('p');progress.textContent=job.progress;
  card.append(status,title,progress);
  if(job.result){const detail=document.createElement('details');detail.open=job.status!=='running';const summary=document.createElement('summary');summary.textContent='Result';const result=document.createElement('div');result.className='job-result';result.textContent=job.result;detail.append(summary,result);card.append(detail);}
  const buttons=document.createElement('div');buttons.className='job-actions';
  const folder=document.createElement('button');folder.className='secondary';folder.textContent='Open files ↗';folder.onclick=()=>api.openJobFolder(job.id).catch(e=>toast(e.message));buttons.append(folder);
  const preview=document.createElement('button');preview.className='secondary';preview.textContent='Preview files';preview.onclick=()=>showJobFiles(job.id);buttons.append(preview);
  const action=document.createElement('button');action.className='secondary';action.textContent=job.status==='running'?'Stop':'Continue / retry';action.onclick=async()=>{try{if(job.status==='running')await api.stopBackgroundJob(job.id);else{$('background-goal').value=job.goal;$('background-form').dataset.jobId=job.id;$('background-goal').focus();toast('Edit the request or start again. The agent will keep the task’s files.');}}catch(e){toast(e.message);}};buttons.append(action);card.append(buttons);list.append(card);
 }
}
async function loadJobs(){try{const state=await api.backgroundJobs();jobRecords=state.jobs;$('agent-connection').textContent=state.available?'Agent runtime found. Uses your Codex sign-in and usage limits.':'Background agents need Codex CLI installed and signed in. Your screen companion can still use its configured AI provider.';renderJobs();}catch(e){$('agent-connection').textContent=e.message;}}
jobsNav.onclick=()=>{showPage('background-tasks');$('page-label').textContent='Background tasks';loadJobs();};
$('background-form').onsubmit=async e=>{e.preventDefault();const button=e.currentTarget.querySelector('button');button.disabled=true;try{await api.startBackgroundJob($('background-goal').value,e.currentTarget.dataset.jobId||undefined);delete $('background-form').dataset.jobId;$('background-goal').value='';await loadJobs();}catch(error){toast(error.message);}finally{button.disabled=false;}};
api.onNative(event=>{if(event.type==='background-job'){const index=jobRecords.findIndex(j=>j.id===event.job.id);if(index<0)jobRecords.unshift(event.job);else jobRecords[index]=event.job;renderJobs();if(['done','error'].includes(event.job.status))toast(event.job.status==='done'?'Your background task is ready. Open Background tasks to see the result.':'A background task needs attention. Open Background tasks for details.');}});
loadJobs();
document.querySelector('main').insertAdjacentHTML('beforeend','<dialog id="job-preview"><div class="preview-heading"><strong>Task files</strong><button id="close-job-preview" class="secondary">Close</button></div><div class="preview-layout"><div id="job-file-list"></div><div id="job-file-content">Choose a file to preview.</div></div></dialog>');
$('close-job-preview').onclick=()=>$('job-preview').close();
async function showJobFiles(id){try{const files=await api.jobFiles(id);$('job-file-list').replaceChildren();$('job-file-content').textContent=files.length?'Choose a file to preview.':'No files have been created yet.';for(const file of files){const button=document.createElement('button');button.className='text-button';button.textContent=file.name;button.onclick=async()=>{try{const value=await api.previewJobFile(id,file.name),view=$('job-file-content');view.replaceChildren();const title=document.createElement('strong');title.textContent=value.name;view.append(title);if(value.kind==='image'){const image=document.createElement('img');image.src=value.content;image.alt=value.name;view.append(image);}else{const text=document.createElement('pre');text.textContent=value.content;view.append(text);}}catch(e){toast(e.message);}};$('job-file-list').append(button);}$('job-preview').showModal();}catch(e){toast(e.message);}}

// Keep the floating companion switchable from the dashboard. The orb's own menu can
// hide it, and without a control here there would be no way to bring it back.
function syncCompanionToggle(){
 const button=document.getElementById('home-companion');
 if(!button||!prefs)return;
 const on=!!prefs.companion;
 button.setAttribute('aria-pressed',String(on));
 button.textContent=on?'Floating companion · on':'Floating companion · off';
 document.getElementById('home-companion-note').textContent=on
  ?'Sits beside your cursor. Click it to talk.'
  :'Turned off. Turn it back on to see it beside your cursor.';
}
document.addEventListener('prefs-loaded',syncCompanionToggle);
document.getElementById('home-companion').onclick=async()=>{
 try{
  const next=!(prefs&&prefs.companion);
  const result=await window.dexterity.companion(next);
  if(prefs)prefs.companion=result;
  syncCompanionToggle();
 }catch(error){
  document.getElementById('home-companion-note').textContent=error.message;
 }
};
window.dexterity.onNative(event=>{
 if(event&&event.type==='companion'){if(prefs)prefs.companion=event.enabled;syncCompanionToggle();}
});
