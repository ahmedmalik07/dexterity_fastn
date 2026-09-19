const {test}=require('node:test');
const assert=require('node:assert/strict');
const {conversationRequest}=require('../electron/conversation.cjs');
test('conversation never inherits desktop automation mode or executes spoken imperatives',()=>{
 for(const text of ['Open this menu','Fill this form','Click that','What does this mean?']){
  const request=conversationRequest(text,{mode:'do',windowId:'42'});
  assert.equal(request.mode,'answer');assert.equal(request.companion,true);
 }
});
test('walkthrough continuations preserve original goal and target',()=>{
 const previous={mode:'teach',rootGoal:'Teach me DaVinci Resolve',windowId:'42',screen:true};
 for(const text of ['Continue','I did that','Next step','What is next?']){
  const request=conversationRequest(text,previous);assert.equal(request.mode,'teach');assert.equal(request.rootGoal,previous.rootGoal);assert.equal(request.windowId,'42');
 }
 assert.equal(conversationRequest('What does contrast mean?',previous).mode,'answer');
 assert.equal(conversationRequest('Where is the color tab?').mode,'teach');
});
test('screen opt-out and input validation survive the conversation boundary',()=>{
 assert.equal(conversationRequest('Explain it',{screen:false}).screen,false);
 for(const input of [null,'','   ','a'.repeat(4001)])assert.throws(()=>conversationRequest(input));
});
