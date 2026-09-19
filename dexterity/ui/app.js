const $ = id => document.getElementById(id);
const api = window.dexterity;
let prefs, captured = false, busy = false, guide, stepIndex = 0, sessions = [], companion = false, demoSession = false, toastTimer;
function toast(message) { $('toast').textContent = String(message).replace(/^Error invoking remote method '[^']+': Error: /, ''); $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 6500); }
function showPage(name) {
 window.scrollTo(0, 0);
 document.querySelectorAll('.page').forEach(el => el.hidden = el.id !== name);
 document.querySelectorAll('.nav').forEach(el => el.classList.toggle('active', el.dataset.page === name));
 $('page-label').textContent = { home: 'Overview', guide: 'Screen assistant', history: 'Session history', settings: 'Settings', forms: 'Fill a form', assistant: 'Ask Dexterity', playbook: 'Playbook', team: 'How it works', context: 'My context' }[name] || 'Workspace';
 if (name === 'history') renderHistory();
 if (name !== 'guide') speechSynthesis.cancel();
}
function syncSettings() {
 $('model').value = prefs.model; $('voice').checked = prefs.voice;
 if($('router-key')){$('router-key').value='';$('router-key').placeholder=prefs.hasRouterKey?'Key saved — enter a replacement':'Paste your OpenRouter API key';$('router-model').value=prefs.routerModel||'google/gemini-2.5-pro';$('router-status').textContent=prefs.bundledRouterKey?'Using this build’s built-in demo key. Paste your own to replace it.':prefs.hasRouterKey?'Your OpenRouter key is saved and used first for AI requests.':'Add OpenRouter for screen understanding and multilingual voice.';}
 if($('speech-mode')){$('speech-mode').value=prefs.speechMode;$('speech-language').value=prefs.speechLanguage;$('speech-pause').value=String(prefs.speechPause);}
 if($('speech-vocabulary'))$('speech-vocabulary').value=prefs.speechVocabulary||'';
 if($('voice-review'))$('voice-review').checked=prefs.voiceReview===true;
 $('gemini-key').value=''; $('gemini-key').placeholder=prefs.hasGeminiKey?'Key saved — enter a new key to replace it':'Paste your Google AI Studio API key';
 $('gemini-key-status').textContent=prefs.hasGeminiKey?(prefs.encrypted?'Gemini key saved with Windows encryption.':'Gemini key available for this visit only.'):'Add a Gemini key to enable the backup.';
 if($('ctrl-activation')) { $('ctrl-activation').checked=prefs.ctrlActivation; $('triple-activation').checked=prefs.tripleActivation; }
 companion=prefs.companion; $('companion').setAttribute('aria-pressed',companion);
 $('api-key').value = ''; $('api-key').placeholder = prefs.hasKey ? 'Key saved — enter a new key to replace it' : 'sk-…';
 $('key-status').textContent = prefs.hasKey ? (prefs.encrypted ? 'Key saved with Windows encryption. It is never returned to the interface.' : 'Key available for this visit only; encryption is unavailable.') : 'Your key is stored with Windows encryption when available.';
}
function configureSession() {
 demoSession=false;
 $('mode').textContent='Live · your screen';
 $('screenshot').hidden=!captured; $('empty-screen').hidden=captured;
 $('capture').hidden=false; $('screen-label').textContent='Screen preview';
 $('capture-time').textContent=captured?'Captured this session':'No capture yet';
 $('privacy-note').textContent='Preview before sending. Capture again after your screen changes.';
 $('send-note').textContent=prefs?.hasKey?(prefs.hasGeminiKey?'Sends to OpenAI · Google backup if unavailable':'Sends this screenshot and question to OpenAI'):'Sends this screenshot and question to Google';
}
function resetAnswer() { guide = null; $('answer').hidden = true; $('answer-empty').hidden = false; speechSynthesis.cancel(); }
function startSession(isDemo, question = '') { if (busy) return toast('Please wait for the current answer.'); configureSession(isDemo); resetAnswer(); $('question').value = question; showPage('guide'); }
function say(text) { speechSynthesis.cancel(); if (prefs.voice) { const utterance = new SpeechSynthesisUtterance(text); utterance.rate = .98; utterance.onerror = e => { if (!['interrupted', 'canceled'].includes(e.error)) toast('Voice is unavailable on this device. You can still follow the written steps.'); }; speechSynthesis.speak(utterance); } }
function renderGuide(read = true) {
 $('answer-empty').hidden = true; $('answer').hidden = false; $('summary').textContent = guide.summary;
 $('answer-tag').textContent = `${guide.provider || 'AI'} · ${guide.model || prefs.model}${guide.fallbackReason ? ' · BACKUP' : ''}`; $('answer-tag').title=guide.fallbackReason || 'Screen guidance';
 $('steps').replaceChildren();
 guide.steps.forEach((step, i) => {
  const card = document.createElement('div'); card.className = 'step' + (i === stepIndex ? ' current' : '');
  const number = document.createElement('span'); number.className = 'step-num'; number.textContent = i < stepIndex ? '✓' : i + 1;
  const content = document.createElement('div'), title = document.createElement('strong'), detail = document.createElement('p'); title.textContent = step.title; detail.textContent = step.detail;
  content.append(title, detail);
  if (step.x !== null && step.y !== null) { const button = document.createElement('button'); button.className = 'text-button'; button.textContent = '◎ Show me where'; button.onclick = async () => { try { await api.point(step); } catch (e) { toast(e.message); } }; content.append(button); }
  card.append(number, content); $('steps').append(card);
 });
 $('previous').disabled = stepIndex === 0; $('next').textContent = stepIndex >= guide.steps.length - 1 ? 'Finish ✓' : 'Next →';
 $('step-progress').textContent = guide.steps.length ? `${stepIndex + 1} of ${guide.steps.length}` : 'All clear';
 if (read) say(guide.steps[stepIndex] ? `${guide.steps[stepIndex].title}. ${guide.steps[stepIndex].detail}` : guide.summary);
}
function renderHistory() {
 $('history-count').textContent = sessions.length; $('history-list').replaceChildren();
 if (!sessions.length) { const empty = document.createElement('div'); empty.className = 'empty-history'; empty.textContent = 'Your next aha moment starts with a question. Start a session to see it here.'; $('history-list').append(empty); }
 sessions.forEach(session => { const button = document.createElement('button'); button.className = 'history-item'; const title = document.createElement('strong'), meta = document.createElement('small'); title.textContent = session.question; meta.textContent = `${session.demo ? 'Demo' : 'Live screen'} · ${session.guide.steps.length} steps · ${session.time}`; button.append(title, meta); button.onclick = () => { if (busy) return toast('Please wait for the current answer.'); configureSession(session.demo); guide = structuredClone(session.guide); if (!session.demo) guide.steps.forEach(s => { s.x = null; s.y = null; }); stepIndex = 0; $('question').value = session.question; showPage('guide'); renderGuide(false); }; $('history-list').append(button); });
}
async function captureScreen() {
 if (busy) return toast('Please wait for the current answer.');
 busy = true; $('capture').disabled = true;
 try { const result = await api.capture(); captured = true; $('screenshot').src = result.image; configureSession(false); resetAnswer(); $('capture-time').textContent = new Date(result.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); showPage('guide'); toast('Screen captured. Review it, then ask your question.'); } catch (e) { toast(e.message); }
 finally { busy = false; $('capture').disabled = false; }
}
document.querySelectorAll('[data-page]').forEach(button => button.onclick = () => showPage(button.dataset.page));
$('start').onclick = () => startSession(prefs.demo);

document.querySelectorAll('[data-question]').forEach(button => button.onclick = () => startSession(prefs.demo, button.dataset.question));
$('capture').onclick = captureScreen;
api.onCapture(captureScreen);
$('clear').onclick = async () => { if (busy) return toast('Please wait for the current answer.'); await api.clearCapture(); captured = false; $('screenshot').removeAttribute('src'); $('question').value = ''; resetAnswer(); configureSession(demoSession); toast('Screenshot and current guidance cleared.'); };
$('ask-form').onsubmit = async event => {
 event.preventDefault(); if (busy) return;
 const question = $('question').value.trim(); if (!question) return toast('Tell Dexterity what you would like help with.');
 if (!demoSession && !captured) return toast('Capture your screen before asking Dexterity.');
 if (!demoSession && !prefs.hasAIKey) { showPage('settings'); return toast('Add your API key to use live screen guidance.'); }
 busy = true; $('ask').disabled = true; $('ask').textContent = 'Thinking…';
 try { guide = await api.analyze(question); stepIndex = 0; renderGuide(); sessions.unshift({ question, guide: structuredClone(guide), demo: demoSession, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }); sessions = sessions.slice(0, 20); renderHistory(); }
 catch (e) { toast(e.message); }
 finally { busy = false; $('ask').disabled = false; $('ask').textContent = 'Ask Dexterity ↑'; }
};
$('previous').onclick = () => { if (guide && stepIndex > 0) { stepIndex--; renderGuide(); } };
$('next').onclick = () => { if (!guide) return; if (stepIndex < guide.steps.length - 1) { stepIndex++; renderGuide(); } else { speechSynthesis.cancel(); toast('Nicely done. Capture a fresh screen whenever you need the next step.'); } };
$('read-again').onclick = () => { if (!prefs.voice) return toast('Enable “Read steps aloud” in Settings first.'); if (guide) renderGuide(); };
$('stop-voice').onclick = () => speechSynthesis.cancel();
$('companion').onclick = async () => { try { companion = await api.companion(!companion); prefs.companion=companion; $('companion').setAttribute('aria-pressed', companion); toast(companion ? 'Click the companion to talk. Right-click it to open the menu.' : 'Floating companion paused. Voice shortcuts still work.'); } catch (e) { toast(e.message); } };
$('settings-form').onsubmit = async event => { event.preventDefault(); try { prefs = await api.saveSettings({routerKey:$('router-key').value,routerModel:$('router-model').value.trim(), key: $('api-key').value, model: $('model').value.trim(), voice: $('voice').checked, geminiKey:$('gemini-key').value,speechMode:$('speech-mode').value,speechLanguage:$('speech-language').value,speechPause:Number($('speech-pause').value), speechVocabulary:$('speech-vocabulary')?.value||'', voiceReview:$('voice-review')?$('voice-review').checked:true, ctrlActivation:$('ctrl-activation').checked, tripleActivation:$('triple-activation').checked }); syncSettings(); toast('Preferences saved. You’re ready to start a session.'); document.dispatchEvent(new Event('prefs-loaded')); } catch (e) { toast(e.message); } };
$('remove-key').onclick = async () => { try { prefs = await api.saveSettings({ ...prefs, removeKey: true }); syncSettings(); document.dispatchEvent(new Event('prefs-loaded'));toast('OpenAI key removed.'); } catch (e) { toast(e.message); } };
$('remove-gemini-key').onclick=async()=>{try{prefs=await api.saveSettings({...prefs,removeGeminiKey:true});syncSettings();document.dispatchEvent(new Event('prefs-loaded'));toast('Gemini key removed.');}catch(e){toast(e.message);}};
api.settings().then(value => { prefs = value; syncSettings(); configureSession(prefs.demo); renderHistory(); document.dispatchEvent(new Event('prefs-loaded')); }).catch(e => toast(e.message));
