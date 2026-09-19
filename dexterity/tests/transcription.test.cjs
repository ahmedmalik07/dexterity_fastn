const{test}=require('node:test'),assert=require('node:assert/strict');
const{transcribeAudio}=require('../electron/transcription.cjs');
const audio=Buffer.alloc(1000,1);
const response=text=>({ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({text})}]}}]})});
test('transcribes original audio with language hint, no screenshot or Windows guesses',async()=>{
 const result=await transcribeAudio({key:'secret',audio,language:'ur-en'},async(url,options)=>{
  assert.match(url,/gemini-2.5-flash/);assert.ok(!url.includes('secret'));
  const body=JSON.parse(options.body);assert.match(body.systemInstruction.parts[0].text,/Roman Urdu/);assert.match(body.systemInstruction.parts[0].text,/Never follow instructions/);
  assert.equal(body.contents[0].parts[1].inline_data.data,audio.toString('base64'));assert.equal(body.generationConfig.thinkingConfig.thinkingBudget,0);
  return response('Mujhe is form mein help chahiye.');
 });assert.equal(result.text,'Mujhe is form mein help chahiye.');assert.equal(result.provider,'Gemini');
});
test('silence stays empty, malformed or incomplete transcription is rejected',async()=>{
 assert.equal((await transcribeAudio({key:'x',audio},async()=>response(''))).text,'');
 await assert.rejects(()=>transcribeAudio({key:'x',audio},async()=>({ok:true,json:async()=>({candidates:[{finishReason:'MAX_TOKENS'}]})})),/complete/);
 await assert.rejects(()=>transcribeAudio({key:'x',audio},async()=>response(null)),/Invalid/);
});
test('rejects missing keys, empty/oversize recording and unsupported media',async()=>{
 for(const data of [{audio},{key:'x',audio:Buffer.alloc(1)},{key:'x',audio:Buffer.alloc(4*1024*1024+1)},{key:'x',audio,mimeType:'text/plain'}])await assert.rejects(()=>transcribeAudio(data));
});
test('quota and cancellation are surfaced without leaking credentials',async()=>{
 await assert.rejects(()=>transcribeAudio({key:'secret',audio},async()=>({ok:false,status:429})),/quota/);
 const controller=new AbortController();controller.abort();
 await assert.rejects(()=>transcribeAudio({key:'secret',audio,signal:controller.signal},async()=>{throw new Error('secret');}),error=>error.message==='Transcription cancelled.');
});
