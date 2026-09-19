const api=window.dexterity,$=id=>document.getElementById(id);
let working=false,fresh=false;
let handsfree=false,speechSerial=0,resumeTimer;
function hush(){speechSerial++;clearTimeout(resumeTimer);speechSynthesis.cancel();}
const attempt=async fn=>{try{$('notice').textContent='';await fn();}catch(e){$('notice').textContent=e.message.replace(/^Error invoking remote method '[^']+': Error: /,'');}};
$('close').onclick=()=>{hush();api.hideCoach();};$('dashboard').onclick=()=>api.open();
$('point').onclick=()=>attempt(()=>api.pointLesson());$('next').onclick=()=>attempt(()=>api.nextLesson());
$('talk').onclick=()=>{hush();attempt(()=>api.coachListen());};$('stop').onclick=()=>{hush();api.voiceConversation(false);api.stopTask();};
$('handsfree').onclick=()=>{hush();attempt(()=>api.voiceConversation(!handsfree));};
$('followup').onsubmit=e=>{e.preventDefault();if(working)return;const text=$('message').value.trim();if(!text)return;attempt(async()=>{await api.askCompanion(text,{screen:$('share-screen').checked,fresh});fresh=false;$('message').value='';});};
$('message').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('followup').requestSubmit();}};
$('new-chat').onclick=()=>attempt(async()=>{await api.clearTask();fresh=true;$('question').hidden=true;$('answer').textContent='A fresh start. What’s on your mind?';$('point').hidden=true;$('next').hidden=true;$('message').focus();});
api.onCoach(data=>{
 hush();const serial=speechSerial;
 working=!!data.busy;$('answer').textContent=data.answer;
 if(data.goal){$('question').textContent=data.goal;$('question').hidden=false;}
 $('point').hidden=!data.target||working;$('next').hidden=!data.teach||working;$('stop').hidden=!working;
 for(const id of ['talk','send','message','share-screen','new-chat'])$(id).disabled=working;
 $('state').textContent=working?'thinking with you…':data.status==='error'?'let’s try that again':'right here with you';
 $('provider').textContent=working?'Escape to stop':(data.provider||'Dexterity')+' · Mic off';$('notice').textContent='';
 const done=()=>{if(serial!==speechSerial)return;if(data.replyToken)resumeTimer=setTimeout(()=>attempt(()=>api.voiceReplyDone(data.replyToken)),500);};
 if(!working&&data.speak){const speech=new SpeechSynthesisUtterance(data.answer);speech.rate=1;speech.onend=done;speech.onerror=()=>{if(serial===speechSerial){api.voiceConversation(false);$('notice').textContent='Speech playback stopped. You can continue by typing or press Talk.';}};speechSynthesis.speak(speech);}else if(!working)done();
});
api.onCoachNotice(text=>$('notice').textContent=text);
api.onNative(event=>{
 if(event.type==='voice-starting')hush();
 if(event.type==='voice-conversation'){handsfree=event.active;$('handsfree').textContent=handsfree?'End hands-free':'Hands-free';$('handsfree').setAttribute('aria-pressed',handsfree);if(!handsfree)hush();if(event.reason)$('notice').textContent=event.reason;}
});
api.voiceConversationState().then(state=>{handsfree=state.active;$('handsfree').setAttribute('aria-pressed',handsfree);});
