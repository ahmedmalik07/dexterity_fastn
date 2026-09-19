document.getElementById('cancel').onclick=()=>window.dexterity.stopListening();
document.getElementById('done').onclick=()=>window.dexterity.finishListening();
window.dexterity.onNative(event=>{
 if(event.type==='listening' && event.active) {
  const cloud=event.engine!=='Windows offline';
  document.getElementById('title').textContent=event.phase==='starting'?'Starting microphone…':'Listening to you…';
  document.getElementById('voice-provider').textContent=cloud?event.engine+' voice · local speech detection':'Windows offline · audio stays on this device';
  document.getElementById('transcript').textContent=cloud?'Speak naturally. Pause when done, or click Done speaking.':'Ask about what you see, or say “teach me this app”.';
  document.getElementById('done').hidden=!cloud;document.getElementById('done').disabled=event.phase==='starting';
 }
 if(event.type==='voice-transcribing') { document.getElementById('title').textContent='Writing what you said…';document.getElementById('voice-provider').textContent=event.engine+' voice · microphone off';document.getElementById('transcript').textContent='Your task starts automatically when transcription finishes. Escape cancels.';document.getElementById('done').disabled=true;document.getElementById('voice-countdown').textContent='Microphone off'; }
 if(event.type==='partial') document.getElementById('transcript').textContent=event.text;
 if(event.type==='audio-level') document.querySelectorAll('.bars i').forEach((bar,i)=>bar.style.height=(5+Math.min(20,event.level*.35)*(.4+Math.sin(i+1)**2))+'px');
});
