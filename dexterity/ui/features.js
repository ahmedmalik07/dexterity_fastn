// Native capabilities are separate from the AI screen guide: no API key is needed.
document.querySelector('.brand .logo').innerHTML='<img src="dexterity-mark.svg" alt="Dexterity">';
document.querySelectorAll('.small-orb').forEach(el=>el.innerHTML='<img src="dexterity-mark.svg" alt="">');
document.querySelector('.mascot').innerHTML='<img class="hero-mark" src="dexterity-mark.svg" alt="">';
document.querySelector('.version').textContent='DESKTOP v1.6';
document.querySelector('nav').insertAdjacentHTML('beforeend','<button class="nav" id="forms-nav" data-page="forms"><span>▤</span>Fill a form <b>NEW</b></button>');
document.querySelector('.header-right').insertAdjacentHTML('afterbegin','<button class="talk-button" id="talk-now"><span class="mic-symbol">●</span> Talk to Dexterity</button>');
document.querySelector('#home .hero').insertAdjacentHTML('beforebegin',`<div class="get-started"><div class="get-started-title"><strong>Start here. Three ways to use Dexterity.</strong><span id="native-status">Checking voice…</span></div><div class="setup-options"><button id="setup-talk"><span class="setup-num">01</span><div><strong>Talk to Dexterity</strong><p>Hold Ctrl for 3 seconds or triple-click.<br>Multilingual Gemini voice when connected.</p></div><span>↗</span></button><button id="setup-forms"><span class="setup-num">02</span><div><strong>Fill & submit a form</strong><p>Inspect fields, enter your details,<br>then review and submit.</p></div><span>↗</span></button><button id="setup-ai"><span class="setup-num">03</span><div><strong>Understand your screen</strong><p id="ai-setup-note">Add an OpenAI or Gemini key.<br>Preview a screenshot, then ask.</p></div><span>↗</span></button></div></div>`);
document.querySelector('#settings-form .settings-actions').insertAdjacentHTML('beforebegin',`<h3 class="setting-heading">Voice activation</h3><p class="setting-help">Both shortcuts work anywhere while Dexterity is running. Nothing is recorded until you activate the microphone. Gemini voice sends your short recording to Google for transcription. Windows offline keeps audio on this device.</p><div class="setting-row"><div><strong>Hold Ctrl for 3 seconds</strong><p>Activates once per hold. Ctrl shortcuts such as copy are ignored.</p></div><input type="checkbox" id="ctrl-activation" checked></div><div class="setting-row"><div><strong>Triple left-click</strong><p>Three clicks in the same spot, within 0.9 seconds. Normal clicks still reach the app.</p></div><input type="checkbox" id="triple-activation" checked></div><button class="secondary" id="mic-settings" type="button">Open Windows microphone settings</button><p class="setting-help">Speak naturally, then pause or choose Done speaking. Your task starts automatically after transcription. Cancel discards your recording; once transcription has started, it stops waiting for the result.</p>`);
document.querySelector('main').insertAdjacentHTML('beforeend',`<section id="forms" class="page" hidden><div class="eyebrow">LESS TYPING. MORE DOING.</div><h1>Let Dexterity handle the form.</h1><p class="subtitle">Typing and filling use Windows accessibility. Dictation follows your speech settings.</p><div class="form-instructions"><span>1 &nbsp; Open your form behind Dexterity</span><span>2 &nbsp; Inspect & enter details</span><span>3 &nbsp; Fill, review & submit</span></div><div class="session-toolbar"><span class="mode-badge">Local automation · no API key</span><button class="secondary" id="practice-form">Open a practice form</button><button class="primary" id="inspect-form">Inspect form ↗</button></div><div class="form-workspace"><div class="form-editor"><div class="panel-top"><strong id="form-title">No form selected yet</strong><span id="form-count"></span></div><div id="form-empty"><img src="dexterity-mark.svg" alt=""><h3>A helping hand with the paperwork.</h3><p>Open a browser or desktop form, bring Dexterity back, and choose <strong>Inspect form</strong>. Dexterity briefly hides to read the app behind it.</p><p>Or say <strong>“fill this form”</strong> while looking at your form.</p></div><form id="field-form" hidden><div id="field-list"></div><div class="form-actions"><button class="primary" id="fill-fields" type="submit">Fill reviewed fields</button><span id="fill-status">Nothing has been typed or submitted.</span></div></form></div><div class="submit-card"><span class="answer-tag">YOU MAKE THE FINAL CALL</span><h3>Check it. Then send it.</h3><p>After filling, review the values in your form. Select the exact button you want Dexterity to press.</p><label for="submit-button">Submission button</label><select id="submit-button" disabled><option value="">Inspect a form first</option></select><label class="review-check"><input type="checkbox" id="review-confirm" disabled><span>I reviewed the filled values and want to activate this button.</span></label><button class="primary" id="submit-form" disabled>Submit reviewed form</button><p id="submit-status" role="status">Dexterity never submits from a voice command alone.</p><div class="form-tip">Passwords are skipped. If a page changes, inspect it again. Some custom controls, CAPTCHA, dropdowns and elevated apps require manual interaction.</div></div></div></section>`);
$('ask-form').insertAdjacentHTML('afterbegin','<div id="heard-banner" hidden><span>Heard you</span><button type="button" class="text-button" id="listen-again">Try again</button><p id="heard-text"></p></div>');
$('forms-nav').onclick=()=>showPage('forms');
document.querySelector('#forms .session-toolbar').insertAdjacentHTML('afterend','<div class="window-picker"><label for="form-window">Which app contains your form?</label><select id="form-window"><option value="">App behind Dexterity</option></select><button class="secondary" id="refresh-windows">Refresh windows</button></div>');
async function refreshWindows(){try{const windows=await api.listFormWindows(),previous=$('form-window').value;$('form-window').replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent='App behind Dexterity';$('form-window').append(empty);for(const window of windows){const option=document.createElement('option');option.value=window.id;option.textContent=window.title;$('form-window').append(option);}if(windows.some(w=>w.id===previous))$('form-window').value=previous;}catch(e){toast(e.message);}}
$('refresh-windows').onclick=refreshWindows;
document.querySelector('.window-picker').insertAdjacentHTML('beforebegin','<div class="browser-launch"><div><strong>Filling a web form?</strong><p>Use your current signed-in browser. Select its window below to open a new tab in the same session.</p></div><input id="form-url" type="url" placeholder="https://your-form.com" aria-label="Form website address"><button class="secondary" id="open-form-browser">Open in my browser ↗</button></div>');
$('open-form-browser').onclick=async()=>{try{await api.openFormBrowser($('form-url').value,$('form-window').value);toast('Opened a tab in your existing browser session. Refresh the window list, then inspect your form.');}catch(e){toast(e.message);}};
$('form-window').onchange=()=>{formSnapshot=null;invalidateFilled();$('field-form').hidden=true;$('form-title').textContent='Window changed — inspect it first';};
$('forms-nav').onclick=()=>{showPage('forms');refreshWindows();};
$('setup-forms').onclick=()=>{showPage('forms');refreshWindows();};
$('setup-ai').onclick=()=>{ if(prefs?.hasAIKey) startSession(false); else {showPage('settings');$('api-key').focus();} };
$('mic-settings').onclick=()=>api.openSpeechSettings();
document.querySelector('#settings-form .setting-heading').insertAdjacentHTML('beforebegin',`<h3 class="setting-heading">Speech recognition</h3><label for="speech-mode">How to understand your voice</label><select id="speech-mode"><option value="auto">Automatic · Gemini when available (recommended)</option><option value="gemini">Gemini · multilingual, uses internet</option><option value="offline">Windows offline · installed speech language</option></select><label for="speech-language">What you speak</label><select id="speech-language"><option value="auto">Detect language automatically</option><option value="en">English · any accent</option><option value="ur-en">Urdu + English · Roman Urdu transcript</option></select><label for="speech-pause">Wait before finishing your sentence</label><select id="speech-pause"><option value="2500">2.5 seconds of quiet</option><option value="4000">4 seconds · more time to think</option></select><label for="speech-vocabulary">Words Dexterity keeps mishearing</label><textarea id="speech-vocabulary" rows="2" maxlength="1200" placeholder="Names, apps and places, separated by commas. e.g. IRIS, NADRA, Islamabad, Ahmed, Dexterity"></textarea><small>Add your own names and terms. They are sent with each recording as spelling hints, which is the most effective fix for an accent the recogniser keeps getting wrong.</small><div class="setting-row"><div><strong>Show me what you heard before running</strong><p>Off by default, so a spoken request runs hands-free beside your cursor. Turn it on and the dashboard opens with the recognised text and a five-second countdown, so you can correct a misheard word before anything happens.</p></div><input type="checkbox" id="voice-review"></div><p class="setting-help">Gemini transcribes your actual audio; it does not use Windows' guessed words. Short recordings stay in memory and are not saved by Dexterity. Provider usage and data policies apply. Language and pause options apply to Gemini voice.</p>`);
let voiceActive=false, formSnapshot=null, formFilled=false, formWorking=false, handlingTranscript=false, dictatingField=null;
function setVoiceState(active) { voiceActive=active; $('talk-now').classList.toggle('listening',active); $('talk-now').textContent=active?'■ Stop listening':'● Talk to Dexterity'; }
async function talk(fieldId=null) { if(busy || formWorking) return toast('Finish the current request first.'); speechSynthesis.cancel(); try { if(voiceActive) {dictatingField=null;await api.stopListening();} else {dictatingField=typeof fieldId==='string'?fieldId:null;await api.listen();} } catch(e) { toast(e.message);dictatingField=null;setVoiceState(false); } }
$('talk-now').onclick=talk; $('setup-talk').onclick=talk; $('listen-again').onclick=talk;
async function health() { try { const status=await api.nativeHealth(); $('native-status').textContent=status.speechEngine==='Gemini'?'Gemini voice · multilingual':status.recognizers.length?'Offline voice · '+status.recognizers[0]:'Speech language needed'; if(!status.hooks) $('native-status').textContent='Shortcuts unavailable · use Talk button'; } catch(e) { $('native-status').textContent='Voice unavailable · restart Dexterity'; } }
document.addEventListener('prefs-loaded',()=>{
 $('ai-setup-note').textContent=prefs.hasAIKey?(prefs.hasKey?'OpenAI ready · '+prefs.model:'Gemini ready · '+prefs.geminiModel):'Add an OpenAI or Gemini key in Settings for screen answers.';
 syncSettings();health();
});
api.onNative(async event=>{
 if(event.type==='ready') health();
 if(event.type==='voice-starting') speechSynthesis.cancel();
 if(event.type==='listening') { setVoiceState(event.active); if(event.error) toast(event.error); }
 if(event.type==='voice-transcribing')$('talk-now').textContent='■ Cancel transcription';
 if(event.type==='native-error') { toast(event.error); setVoiceState(false); }
 if(event.type==='companion') { companion=event.enabled; if(prefs)prefs.companion=companion; $('companion').setAttribute('aria-pressed',companion); }
 if(event.type==='transcript' && !handlingTranscript) {
  handlingTranscript=true; setVoiceState(false); speechSynthesis.cancel();
  try {
   const text=event.text.trim(), command=text.toLowerCase().replace(/[.!?]/g,'');
   if(/^(cancel|stop|never mind|stop listening|end conversation)$/.test(command)) {dictatingField=null;await api.voiceConversation(false);return toast('Voice conversation ended.');}
   if(dictatingField && $(dictatingField)) { $(dictatingField).value=text;dictatingField=null;invalidateFilled();await api.open();showPage('forms');toast('Dictation added. Check the value before filling.');return; }
   $('question').value=text;
   const options={conversation:true,remembered:true,companion:true};
   if((event.review??prefs.voiceReview)===true && typeof reviewHeard==='function') reviewHeard(text,options);
   else await api.askCompanion(text,{screen:true,currentScreen:true});
   } catch(e) { await api.voiceConversation(false).catch(()=>{});toast(e.message); }
  finally { handlingTranscript=false; }
 }
});
health();
function updateSubmit() { $('submit-form').disabled=!formFilled || !$('review-confirm').checked || !$('submit-button').value || formWorking; }
function setFormWorking(value) { formWorking=value; for(const id of ['inspect-form','practice-form','fill-fields']) $(id).disabled=value; updateSubmit(); }
function invalidateFilled() { formFilled=false; $('review-confirm').checked=false; $('review-confirm').disabled=true; $('fill-status').textContent='Details changed. Fill the fields again before submitting.'; updateSubmit(); }
function renderForm(snapshot) {
 formSnapshot=snapshot; formFilled=false; $('review-confirm').checked=false; $('review-confirm').disabled=true;
 $('form-title').textContent=snapshot.title; $('form-count').textContent=`${snapshot.fields.length} editable fields`;
 $('field-list').replaceChildren(); $('submit-button').replaceChildren();
 const placeholder=document.createElement('option'); placeholder.value='';placeholder.textContent='Choose the exact button';$('submit-button').append(placeholder);
 for(const button of snapshot.buttons) { const option=document.createElement('option');option.value=button.id;option.textContent=button.label;$('submit-button').append(option); }
 $('submit-button').disabled=!snapshot.buttons.length;
 $('field-form').hidden=!snapshot.fields.length; $('form-empty').hidden=!!snapshot.fields.length;
 if(!snapshot.fields.length) $('form-empty').innerHTML='<h3>No supported fields found.</h3><p>Select your existing signed-in browser window and inspect again. This page may not expose supported accessibility controls; those fields need your help. Dexterity will not create another browser session. You can also try the practice form.</p>';
 for(const field of snapshot.fields) {
  const row=document.createElement('div');row.className='field-row';const label=document.createElement('label');label.htmlFor=field.id;label.textContent=field.label;
  const input=document.createElement('input');input.id=field.id;input.value=field.value;input.maxLength=10000;input.autocomplete='off';input.dataset.fieldId=field.id;input.placeholder='Enter the value to fill';input.oninput=invalidateFilled;
  const dictate=document.createElement('button');dictate.type='button';dictate.className='text-button field-dictate';dictate.textContent='● Dictate';dictate.onclick=()=>talk(field.id);
  row.append(label,input,dictate);$('field-list').append(row);
 }
 $('fill-status').textContent='Nothing has been typed or submitted.';$('submit-status').textContent='Fill your fields first, then review them in the target app.';updateSubmit();
}
async function inspectForm(remembered=false) {
 if(formWorking || busy) return toast('Finish the current request first.');
 setFormWorking(true); showPage('forms'); $('inspect-form').textContent='Inspecting…';
 try { const snapshot=await api.inspectForm(remembered,remembered?'':$('form-window').value); renderForm(snapshot); toast(snapshot.fields.length?'Form found. Enter your values, then fill.':'No supported fields found. Try the practice form.'); }
 catch(e) { formSnapshot=null;invalidateFilled();toast(e.message); }
 finally { setFormWorking(false);$('inspect-form').textContent='Inspect form ↗'; }
}
$('inspect-form').onclick=()=>inspectForm(false);
async function practiceDemo(){
 if(formWorking || busy)return toast('Finish the current request first.');
 showPage('forms');setFormWorking(true);
 try{await api.practiceForm();await refreshWindows();const option=[...$('form-window').options].find(o=>o.textContent==='Dexterity practice form');if(!option)throw new Error('Practice form opened. Refresh the window list, select it and inspect.');$('form-window').value=option.value;setFormWorking(false);await inspectForm(false);}
 catch(e){toast(e.message);}finally{setFormWorking(false);}
}
 $('practice-form').onclick=practiceDemo;
 for(const id of ['demo','side-demo'])$(id).onclick=practiceDemo;
$('field-form').onsubmit=async event=>{
 event.preventDefault();if(formWorking||!formSnapshot)return;
 const values={};document.querySelectorAll('[data-field-id]').forEach(input=>{values[input.dataset.fieldId]=input.value;});
 setFormWorking(true);
 try { const result=await api.fillForm({token:formSnapshot.token,values});formFilled=true;$('review-confirm').disabled=false;$('fill-status').textContent=`Filled ${result.count} fields. Nothing submitted yet.`;$('submit-status').textContent='Review the target form, choose its submission button, and confirm.';toast('Fields filled. Review them in your target app before submitting.'); }
 catch(e){formFilled=false;toast(e.message);}
 finally{setFormWorking(false);}
};
$('review-confirm').onchange=updateSubmit;
$('submit-button').onchange=()=>{$('review-confirm').checked=false;updateSubmit();};
$('submit-form').onclick=async()=>{
 if(!formSnapshot||!formFilled||!$('review-confirm').checked||!$('submit-button').value||formWorking)return;
 setFormWorking(true);
 try{const result=await api.submitForm({token:formSnapshot.token,buttonId:$('submit-button').value,confirmed:true});$('submit-status').textContent=result.message;formFilled=false;$('review-confirm').checked=false;$('review-confirm').disabled=true;toast(result.message);}
 catch(e){toast(e.message);formFilled=false;$('review-confirm').disabled=true;}
 finally{setFormWorking(false);}
};
