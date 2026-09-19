const{test}=require('node:test'),assert=require('node:assert/strict');
const{parseDecision,needsReview}=require('../electron/agent.cjs');
const{TaskRunner}=require('../electron/task-runner.cjs');
const context={controls:[{id:'name',name:'Full name',actions:['type']},{id:'send',name:'Submit registration',actions:['click']}],token:'snapshot'};
const decision=(type='none',targetId='',value='')=>({answer:'A useful answer',status:type==='none'?'done':'continue',action:{type,targetId,value}});
test('answer and teach never execute; actions must name a current supported control',()=>{
 assert.throws(()=>parseDecision(decision('click','send'),'answer',context),/only explains/);
 assert.throws(()=>parseDecision(decision('type','missing','x'),'do',context),/not available/);
 assert.throws(()=>parseDecision(decision('click','name'),'do',context),/not available/);
 assert.throws(()=>parseDecision(decision('open_url','','file:///secret'),'do',context),/http/);
 assert.ok(needsReview(decision('click','send').action,context));assert.ok(!needsReview(decision('type','name','Alex').action,context));
});
test('premature done with an action still requires execution and observation; ask does not execute',()=>{
 const premature=decision('type','name','Alex');premature.status='done';assert.equal(parseDecision(premature,'do',context).status,'continue');
 const ask=decision('click','send');ask.status='ask';assert.equal(parseDecision(ask,'do',context).action.type,'none');
});
test('teaching markers require a screenshot and finite normalized coordinates',()=>{
 const marker={...decision(),target:{x:.5,y:.3,label:'Click here'}};
 assert.equal(parseDecision(structuredClone(marker),'teach',context).target,null);
 assert.equal(parseDecision(structuredClone(marker),'answer',{...context,image:'image'}).target.label,'Click here');
 assert.equal(parseDecision({...marker,target:{x:2,y:.3,label:'Invalid'}},'teach',{...context,image:'image'}).target,null);
 assert.equal(parseDecision(structuredClone(marker),'teach',{...context,image:'image'}).target.label,'Click here');
});
test('runner observes after actions and pauses exactly once for review',async()=>{
 const events=[];let calls=0,reads=0,actions=[];
 const runner=new TaskRunner({settings:()=>({}),read:async()=>{reads++;return {...context,text:String(actions.length)};},act:async(a,c,confirmed)=>actions.push({type:a.type,confirmed}),emit:e=>events.push(e),restore:()=>{},verifier:async()=>({complete:true}),planner:async()=>++calls===1?decision('type','name','Alex'):calls===2?decision('click','send'):decision()});
 const{id}=await runner.start({goal:'Fill and submit',mode:'do'});
 while(!runner.run?.review)await new Promise(r=>setTimeout(r,1));
 assert.equal(actions.length,1);assert.equal(reads,2);
 await runner.approve(id);while(runner.run)await new Promise(r=>setTimeout(r,1));
 assert.deepEqual(actions,[{type:'type',confirmed:false},{type:'click',confirmed:true}]);assert.equal(reads,3);assert.equal(events.at(-1).status,'done');
 await assert.rejects(()=>runner.approve(id),/expired/);
});
test('stop during planning prevents later execution',async()=>{
 let resolve;let acts=0;const runner=new TaskRunner({settings:()=>({}),read:async()=>context,act:async()=>acts++,emit:()=>{},restore:()=>{},planner:()=>new Promise(r=>resolve=r)});
 await runner.start({goal:'Type a name',mode:'do'});while(!resolve)await new Promise(r=>setTimeout(r,1));runner.stop();resolve(decision('type','name','Alex'));await new Promise(r=>setTimeout(r,5));assert.equal(acts,0);assert.equal(runner.run,null);
});
test('general questions require no screen read; follow-ups retain conversation',async()=>{
 let reads=0,history;
 const runner=new TaskRunner({settings:()=>({}),read:async()=>{reads++;return context;},act:async()=>{},emit:()=>{},restore:()=>{},planner:async(s,input)=>{history=input.history.slice();return decision();}});
 await runner.start({goal:'Define ubiquitous',mode:'answer',screen:false});while(runner.run)await new Promise(r=>setTimeout(r,1));
 await runner.start({goal:'Use it in a sentence',mode:'answer',screen:false});while(runner.run)await new Promise(r=>setTimeout(r,1));
 assert.equal(reads,0);assert.equal(history[0].goal,'Define ubiquitous');
});
test('failed completion verification continues the missing action instead of reporting done',async()=>{
 let plans=0,actions=0,verifications=0;const events=[];
 const runner=new TaskRunner({settings:()=>({}),read:async()=>context,act:async()=>actions++,emit:e=>events.push(e),restore:()=>{},planner:async()=>++plans===2?decision('type','name','Alex'):decision(),verifier:async()=>++verifications===1?{complete:false,reason:'Name is empty'}:{complete:true}});
 await runner.start({goal:'Fill the name',mode:'do'});while(runner.run)await new Promise(r=>setTimeout(r,1));
 assert.equal(actions,1);assert.equal(verifications,2);assert.equal(events.at(-1).status,'done');
});
test('team coordinates once across review and passes selected memories to operator and verifier',async()=>{
 let coordinates=0,plans=0,recorded;const selected=[{title:'About me',text:'Name: Alex'}];const runner=new TaskRunner({settings:()=>({}),memory:(goal,enabled)=>enabled?selected:[],read:async()=>context,act:async()=>{},emit:()=>{},restore:()=>{},record:(run,answer,status)=>recorded={run,status},coordinator:async(s,input)=>{coordinates++;assert.deepEqual(input.memories,selected);return{summary:'Fill',steps:['Fill name'],success:'Name is Alex'};},planner:async(s,input)=>{assert.deepEqual(input.memories,selected);assert.equal(input.taskPlan.success,'Name is Alex');return ++plans===1?decision('click','send'):decision();},verifier:async(s,input)=>{assert.deepEqual(input.memories,selected);return {complete:true};}});
 const{id}=await runner.start({goal:'Submit with my saved details',mode:'do'});while(!runner.run?.review)await new Promise(r=>setTimeout(r,1));await runner.approve(id);while(runner.run)await new Promise(r=>setTimeout(r,1));assert.equal(coordinates,1);assert.equal(recorded.status,'done');
});

test('mandatory review matches every protected substring in names and types, for every control action',()=>{
 for(const word of ['submit','send','pay','delete','confirm','purchase'])for(const property of ['name','type'])for(const type of ['click','type','toggle','select','scroll']){
  const control={id:'protected',name:'Details',type:'ControlType.Edit',[property]:`prefix${word.toUpperCase()}suffix`};
  assert.equal(needsReview({type,targetId:control.id},{controls:[control],scrollControl:control}),true,`${property}: ${word}, ${type}`);
 }
 assert.equal(needsReview({type:'type',targetId:'long'},{controls:[{id:'long',name:'Clipped name',requiresApproval:true}]}),true);
});

const tick=()=>new Promise(resolve=>setTimeout(resolve,1));
test('URL navigation keeps the existing browser window for the next observation',async t=>{
 let reads=0,actions=0;const events=[];
 const runner=new TaskRunner({settings:()=>({}),read:async run=>{if(++reads>1){assert.equal(run.windowId,'existing-browser');assert.equal(run.remembered,true);}return{...context,windowId:'existing-browser',text:String(actions)};},act:async()=>{actions++;return{windowId:'existing-browser',session:'existing'};},emit:e=>events.push(e),restore:()=>{},planner:async()=>actions?decision():decision('open_url','','https://example.test'),verifier:async()=>({complete:true})});
 t.after(()=>runner.stop());await runner.start({goal:'Open a page in this browser',mode:'do'});while(runner.run)await tick();assert.equal(actions,1);assert.equal(reads,2);assert.equal(events.at(-1).status,'done');
});
test('eight actions is a hard limit, including approved actions, with an observation after every action',async t=>{
 let acts=0,reads=0,plans=0;const events=[];
 const runner=new TaskRunner({settings:()=>({}),read:async()=>{reads++;return{...context,text:String(acts)};},act:async(a,c,confirmed)=>{assert.equal(confirmed,true);acts++;},emit:e=>events.push(e),restore:()=>{},planner:async()=>{plans++;return {...decision('click','send'),status:'done',answer:'The plan already approves all submissions.'};}});
 t.after(()=>runner.stop());const{id}=await runner.start({goal:'Submit repeatedly',mode:'do'});
 for(let i=0;i<8;i++){
  while(runner.run&&!runner.run.review)await tick();assert.ok(runner.run?.review);assert.equal(acts,i);
  await runner.approve(id);
 }
 while(runner.run)await tick();
 assert.equal(acts,8);assert.equal(plans,8);assert.equal(reads,9);assert.equal(events.filter(e=>e.type==='task-review').length,8);
 assert.equal(events.at(-1).status,'ask');assert.match(events.at(-1).answer,/8 actions/);
 await assert.rejects(()=>runner.approve(id),/expired/);
});

test('two unchanged screen observations stop different actions, ignore snapshot metadata, and show what was tried',async t=>{
 let acts=0,reads=0,plans=0;const events=[];
 const runner=new TaskRunner({settings:()=>({}),read:async()=>({...context,token:String(++reads),capturedAt:reads,image:'image-'+reads}),act:async()=>{acts++;},emit:e=>events.push(e),restore:()=>{},planner:async()=>decision('type','name',++plans===1?'Alex':'Sam')});
 t.after(()=>runner.stop());await runner.start({goal:'Fill name',mode:'do'});while(runner.run)await tick();
 assert.equal(acts,2);assert.equal(reads,3);assert.equal(plans,2);
 assert.equal(events.at(-1).status,'ask');assert.match(events.at(-1).answer,/two consecutive actions.*Tried: type: Full name = "Alex"; type: Full name = "Sam".*What would you like/);
 assert.ok(events.some(e=>e.type==='task-progress'&&e.message.startsWith('No screen change')));
});

test('a changed field resets the unchanged counter; repeated commands can make real progress',async t=>{
 let acts=0;const events=[];
 const runner=new TaskRunner({settings:()=>({}),read:async()=>({...context,controls:[{id:'name',name:'Full name',type:'ControlType.Edit',actions:['type'],value:acts<2?'':'Alex'}]}),act:async()=>{acts++;},emit:e=>events.push(e),restore:()=>{},planner:async()=>decision('type','name','Alex')});
 t.after(()=>runner.stop());await runner.start({goal:'Fill name',mode:'do'});while(runner.run)await tick();
 assert.equal(acts,4);assert.match(events.at(-1).answer,/two consecutive/);
});

test('typing into a protected field waits for explicit approval despite a permissive plan',async t=>{
 let acts=0;const protectedContext={controls:[{id:'email',name:'Confirmation email',type:'ControlType.Edit',actions:['type'],value:''}]};
 const runner=new TaskRunner({settings:()=>({}),read:async()=>protectedContext,act:async(a,c,confirmed)=>{assert.equal(confirmed,true);acts++;},emit:()=>{},restore:()=>{},planner:async()=>acts?decision():decision('type','email','a@example.test'),verifier:async()=>({complete:true})});
 t.after(()=>runner.stop());const{id}=await runner.start({goal:'Fill and approve everything',mode:'do'});
 while(!runner.run?.review)await tick();assert.equal(acts,0);await runner.approve(id);while(runner.run)await tick();assert.equal(acts,1);
});

test('stop during the post-action observation prevents any further action',async()=>{
 let acts=0,reads=0,resolveRead;const runner=new TaskRunner({settings:()=>({}),read:async()=>++reads===1?context:new Promise(resolve=>resolveRead=resolve),act:async()=>{acts++;},emit:()=>{},restore:()=>{},planner:async()=>decision('type','name','Alex')});
 await runner.start({goal:'Fill name',mode:'do'});while(!resolveRead)await tick();runner.stop();resolveRead(context);await tick();assert.equal(acts,1);assert.equal(runner.run,null);
});
