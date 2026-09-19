const{test}=require('node:test'),assert=require('node:assert/strict');
const{VoiceConversation}=require('../electron/voice-conversation.cjs');
test('hands-free rearms only once after the matching reply finishes',async t=>{
 let listens=0;const voice=new VoiceConversation({listen:async()=>listens++,emit:()=>{}});t.after(()=>voice.stop());
 await voice.start();voice.thinking();assert.equal(listens,1);const token=voice.reply();assert.equal(voice.state().phase,'speaking');
 assert.equal(await voice.heardReply('wrong'),false);assert.equal(listens,1);assert.equal(await voice.heardReply(token),true);assert.equal(listens,2);assert.equal(await voice.heardReply(token),false);
});
test('Stop and a new session invalidate delayed playback callbacks',async t=>{
 let listens=0;const voice=new VoiceConversation({listen:async()=>listens++,emit:()=>{}});t.after(()=>voice.stop());
 await voice.start();const token=voice.reply();voice.stop();assert.equal(await voice.heardReply(token),false);await voice.start();assert.equal(await voice.heardReply(token),false);assert.equal(listens,2);
});
test('microphone failure and session expiry stop automatic listening',async t=>{
 const failed=new VoiceConversation({listen:async()=>{throw new Error('Microphone missing');},emit:()=>{}});await assert.rejects(failed.start(),/Microphone/);assert.equal(failed.state().active,false);
 let expired=0;const voice=new VoiceConversation({listen:async()=>{},emit:()=>{},onExpire:()=>expired++,limitMs:10});t.after(()=>voice.stop());await voice.start();await new Promise(r=>setTimeout(r,30));assert.equal(voice.state().active,false);assert.equal(expired,1);
});
