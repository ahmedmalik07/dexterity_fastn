// Audio and local neural voice detection run only during an explicitly activated recording.
let recording;
async function release(current){
 clearInterval(current.timer);clearTimeout(current.hardStop);clearTimeout(current.noSpeech);
 current.stream?.getTracks().forEach(track=>track.stop());
 try{await current.vad?.destroy();}catch{}
 try{await current.context?.close();}catch{}
}
async function cancelRecording(){const current=recording;recording=null;if(!current)return;current.cancelled=true;if(current.recorder?.state==='recording')current.recorder.stop();current.chunks=[];await release(current);}
async function finishRecording(){const current=recording;if(!current||current.finishing)return;current.finishing=true;clearInterval(current.timer);if(!current.hasSpeech){await window.dexterity.voiceRecorderError({id:current.id,message:'No clear speech detected. Background sound was ignored. Try speaking closer to the microphone.'});return cancelRecording();}if(current.recorder?.state==='recording')current.recorder.stop();}
async function toWav(blob){
 const decoder=new OfflineAudioContext(1,1,16000),audio=await decoder.decodeAudioData(await blob.arrayBuffer()),samples=audio.getChannelData(0),buffer=new ArrayBuffer(44+samples.length*2),view=new DataView(buffer);
 const text=(offset,s)=>{for(let i=0;i<s.length;i++)view.setUint8(offset+i,s.charCodeAt(i));};text(0,'RIFF');view.setUint32(4,36+samples.length*2,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,samples.length*2,true);for(let i=0;i<samples.length;i++)view.setInt16(44+i*2,Math.max(-1,Math.min(1,samples[i]))*32767,true);return buffer;
}
async function startRecording(options){
 await cancelRecording();const maxSeconds=Math.max(15,Math.min(45,Number(options.maxSeconds)||15));const current={id:options.id,chunks:[],cancelled:false,hasSpeech:false};recording=current;
 try{
  const stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:false},video:false});
  if(recording!==current){stream.getTracks().forEach(t=>t.stop());return;}current.stream=stream;
  const context=new AudioContext();current.context=context;await context.resume();
  current.vad=await vad.MicVAD.new({model:'v5',baseAssetPath:new URL('vendor/voice/',location.href).href,onnxWASMBasePath:new URL('vendor/voice/',location.href).href,ortConfig:ort=>{ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;},audioContext:context,getStream:async()=>stream,pauseStream:async()=>{},resumeStream:async()=>stream,startOnLoad:false,positiveSpeechThreshold:.8,negativeSpeechThreshold:.45,minSpeechMs:350,redemptionMs:options.pauseMs||1200,preSpeechPadMs:250,submitUserSpeechOnPause:false,
   onSpeechRealStart:()=>{if(recording!==current)return;current.hasSpeech=true;clearTimeout(current.noSpeech);document.getElementById('transcript').textContent='I hear you. Finish your sentence, then pause.';},
   onSpeechEnd:()=>{if(recording===current&&!current.finishing)finishRecording();},
   onFrameProcessed:prob=>{if(recording!==current)return;document.querySelectorAll('.bars i').forEach((bar,i)=>bar.style.height=(5+Math.min(20,prob.isSpeech*22)*(.4+Math.sin(i+1)**2))+'px');}
  });
  if(recording!==current){await release(current);return;}
  current.recorder=new MediaRecorder(stream,{mimeType:'audio/webm;codecs=opus',audioBitsPerSecond:64000});
  current.recorder.ondataavailable=e=>{if(!current.cancelled&&e.data.size)current.chunks.push(e.data);};
  current.recorder.onstop=async()=>{
   await release(current);if(current.cancelled||recording!==current)return;
   const blob=new Blob(current.chunks,{type:'audio/webm'});current.chunks=[];
   try{const audio=options.engine==='OpenRouter'?await toWav(blob):await blob.arrayBuffer();if(current.cancelled||recording!==current)return;await window.dexterity.voiceAudio({id:current.id,audio,mimeType:options.engine==='OpenRouter'?'audio/wav':'audio/webm'});}catch(e){await window.dexterity.voiceRecorderError({id:current.id,message:'Could not process microphone audio. Try again.'});}finally{if(recording===current)recording=null;}
  };
  current.recorder.onerror=()=>{window.dexterity.voiceRecorderError({id:current.id,message:'Microphone recording failed. Try again.'});cancelRecording();};
  await current.vad.start();if(recording!==current)return;
  current.recorder.start(100);await window.dexterity.voiceRecorderReady(current.id);if(recording!==current)return;
  const started=performance.now();current.hardStop=setTimeout(finishRecording,maxSeconds*1000);
  current.noSpeech=setTimeout(()=>{if(recording===current&&!current.hasSpeech){window.dexterity.voiceRecorderError({id:current.id,message:'No clear speech detected. Microphone off.'});cancelRecording();}},6000);
  current.timer=setInterval(()=>{document.getElementById('voice-countdown').textContent=Math.max(0,maxSeconds-Math.floor((performance.now()-started)/1000))+'s maximum · Escape cancels';},200);
 }catch(error){if(recording!==current)return;const message=error.name==='NotAllowedError'?'Microphone access is blocked in Windows Settings.':error.name==='NotFoundError'?'No microphone found. Connect one and try again.':'The local speech detector could not start. Restart Dexterity or reinstall dependencies.';await window.dexterity.voiceRecorderError({id:current.id,message});await cancelRecording();}
}
window.dexterity.onVoiceRecord(startRecording);window.dexterity.onVoiceCancel(cancelRecording);window.dexterity.onVoiceFinish(finishRecording);
