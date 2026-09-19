const {test}=require('node:test');
const assert=require('node:assert/strict');
const {analyzeWithFallback,DEFAULT_MODEL,GEMINI_MODEL}=require('../electron/providers.cjs');
const guide={summary:'A visible form',steps:[{title:'Enter your name',detail:'Use the visible field.',x:.2,y:.3}]};
const image='data:image/png;base64,aGVsbG8=';
const openai={ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(guide)}]}]})};
const gemini={ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(guide)}]}}]})};
test('OpenAI is primary and uses the economical default with capped output',async()=>{
 let calls=0;const result=await analyzeWithFallback({key:'test',geminiKey:'backup'},'help',image,async(url,o)=>{calls++;const body=JSON.parse(o.body);assert.match(url,/openai/);assert.equal(body.model,DEFAULT_MODEL);assert.equal(body.store,false);assert.equal(body.reasoning.effort,'low');assert.equal(body.max_output_tokens,2600);return openai;});
 assert.equal(calls,1);assert.equal(result.provider,'OpenAI');assert.equal(result.fallbackReason,undefined);
});
test('Gemini works before OpenAI key is supplied, with image and structured schema',async()=>{
 const result=await analyzeWithFallback({geminiKey:'backup'},'help',image,async(url,o)=>{assert.match(url,new RegExp(GEMINI_MODEL));assert.ok(!url.includes('key='));assert.equal(o.headers['x-goog-api-key'],'backup');const body=JSON.parse(o.body);assert.equal(body.contents[0].parts[1].inline_data.mime_type,'image/png');assert.equal(body.generationConfig.responseJsonSchema.type,'object');return gemini;});
 assert.equal(result.provider,'Gemini');assert.deepEqual(result.steps,guide.steps);
});
for(const status of [401,403,404,429,503])test(`falls back once on OpenAI HTTP ${status}`,async()=>{
 let calls=0;const result=await analyzeWithFallback({key:'test',geminiKey:'backup'},'help',image,async()=>++calls===1?{ok:false,status}:gemini);assert.equal(calls,2);assert.equal(result.provider,'Gemini');assert.ok(result.fallbackReason);
});
test('network failure falls back, both failures report without credentials',async()=>{
 let calls=0;await assert.rejects(()=>analyzeWithFallback({key:'secret-a',geminiKey:'secret-b'},'help',image,async()=>{calls++;if(calls===1)throw new Error('network');return{ok:false,status:403};}),e=>{assert.ok(!e.message.includes('secret'));return /Backup: Gemini/.test(e.message);});assert.equal(calls,2);
});
test('refusal never falls back to another provider',async()=>{
 let calls=0;await assert.rejects(()=>analyzeWithFallback({key:'test',geminiKey:'backup'},'help',image,async()=>{calls++;return{ok:true,json:async()=>({output:[{content:[{type:'refusal'}]}]})};}),/could not help/);assert.equal(calls,1);
});
test('Gemini safety block and truncation are surfaced',async()=>{
 for(const finishReason of ['SAFETY','MAX_TOKENS'])await assert.rejects(()=>analyzeWithFallback({geminiKey:'backup'},'help',image,async()=>({ok:true,json:async()=>({candidates:[{finishReason}]})})),/could not help|incomplete/);
});
test('no keys, invalid images and malformed output never create fake guidance',async()=>{
 await assert.rejects(()=>analyzeWithFallback({},'help',image),/Add an OpenAI or Gemini/);
 await assert.rejects(()=>analyzeWithFallback({geminiKey:'x'},'help','wrong'),/Capture a fresh/);
 await assert.rejects(()=>analyzeWithFallback({geminiKey:'x'},'help',image,async()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:'invalid JSON'}]}}]})})),/JSON/);
});
