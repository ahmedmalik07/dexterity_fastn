const {plan,needsReview,verifyTask}=require('./agent.cjs');
const {estimateCost,addUsage}=require('./core.cjs');
function screenSignature(context){return JSON.stringify([context.windowId,context.title,context.text,context.selectedText,(context.controls||[]).map(c=>[c.name,c.type,c.value])]);}
class TaskRunner {
 constructor(options){Object.assign(this,options);this.history=[];this.run=null;}
 async start(input){
  if(this.run)throw new Error('A task is already running. Stop it first.');
  if(!input||typeof input.goal!=='string'||!input.goal.trim()||input.goal.length>4000)throw new Error('Tell Dexterity what you want to do, in under 4,000 characters.');
  if(!['answer','teach','do'].includes(input.mode))throw new Error('Choose Answer, Teach me, or Do it.');
 const run={id:require('node:crypto').randomUUID(),goal:input.goal.trim(),mode:input.mode,screen:input.screen!==false,windowId:String(input.windowId||''),remembered:!!input.remembered,companion:input.companion===true,progress:[],controller:new AbortController(),count:0,startedAt:Date.now(),requests:0,ledger:[],memories:this.memory?this.memory(input.goal,input.useMemory!==false):[]};
  if(run.mode==='do'&&!run.screen)throw new Error('Turn on Use my screen for Do it.');
  run.rootGoal=input.rootGoal||run.goal;
  this.run=run;run.timer=setTimeout(()=>this.stop('Stopped after two minutes. Narrow the task or continue with a new request.'),120000);
  this.emit({type:'task-start',id:run.id,goal:run.goal,mode:run.mode});
  this.emit({type:'task-memory',titles:run.memories.map(e=>e.title)});
  void this.loop(run);return{id:run.id};
 }
 active(run){return this.run===run&&!run.controller.signal.aborted;}
 // Every model round trip is metered so the interface can show real time, tokens and an estimated price.
 meter(run,role,result){
  run.requests=(run.requests||0)+1;
  run.usage=addUsage(run.usage,result?.usage);
  const model=result?.model||run.lastModel;if(model)run.lastModel=model;
  const cost=estimateCost(model,result?.usage);
  if(cost!==null&&cost!==undefined)run.cost=(run.cost||0)+cost;else if(result?.usage)run.costPartial=true;
  this.emit({type:'task-usage',role,requests:run.requests,seconds:(Date.now()-run.startedAt)/1000,tokens:run.usage,cost:run.cost,costPartial:!!run.costPartial,model:run.lastModel});
 }
 ledger(run,entry){run.ledger=run.ledger||[];const row={...entry,at:Date.now(),second:Math.round((Date.now()-run.startedAt)/100)/10};run.ledger.push(row);this.emit({type:'task-ledger',...row});}
 async loop(run){
  try{
   if(run.mode==='do'&&this.coordinator&&!run.plan){
    this.emit({type:'task-role',role:'Coordinator',message:'Building a plan from your goal and relevant context…'});
    run.plan=await this.coordinator(this.settings(),{goal:run.goal,memories:run.memories,history:this.history},AbortSignal.any([run.controller.signal,AbortSignal.timeout(40000)]));
    if(!this.active(run))return;
    this.meter(run,'Coordinator',run.plan);
    this.emit({type:'task-plan',plan:run.plan});
   }
   while(this.active(run)){
    if(run.count>=8)return this.finish(run,'Stopped after 8 actions. Check the action log. What would you like me to do next?','ask');
    this.emit({type:'task-progress',message:run.screen?'Reading the current screen…':'Thinking about your question…'});
    const context=run.nextContext||(run.screen?await this.read(run):{title:'No screen shared',text:'',selectedText:'',controls:[],scrollable:false});
    run.nextContext=null;
    if(!this.active(run))return;
    run.observation=context;
    if(context.windowId)run.windowId=context.windowId;
    this.emit({type:'task-context',title:context.title,selectedText:context.selectedText,image:context.image,controls:context.controls});
    const timeout=AbortSignal.timeout(40000),signal=AbortSignal.any([run.controller.signal,timeout]);
    this.emit({type:'task-role',role:run.mode==='do'?'Operator':run.mode==='teach'?'Teacher':'Answer specialist',message:run.mode==='do'?'Choosing the next action from the current app…':'Preparing your answer…'});
    const decision=await(this.planner||plan)(this.settings(),{goal:run.goal,mode:run.mode,context,history:this.history,progress:run.progress,memories:run.memories,taskPlan:run.plan},signal);
    if(!this.active(run))return;
    run.lastDecision=decision;this.meter(run,run.mode==='do'?'Operator':run.mode==='teach'?'Teacher':'Answer specialist',decision);
    this.emit({type:'task-answer',answer:decision.answer,provider:decision.provider,model:decision.model});
    if(decision.action.type==='none'){
     if(run.mode==='do' && decision.status==='done'){
      this.emit({type:'task-progress',message:'Checking that the requested result is actually there…'});
      this.emit({type:'task-role',role:'Verifier',message:'Checking the visible result against your goal…'});
      const verified=await(this.verifier||verifyTask)(this.settings(),{goal:run.goal,context,progress:run.progress,answer:decision.answer,memories:run.memories},AbortSignal.any([run.controller.signal,AbortSignal.timeout(40000)]));
      if(!this.active(run))return;
      this.meter(run,'Verifier',verified);
      this.ledger(run,{kind:'check',pass:!!verified.complete,message:verified.complete?'Verified: the requested values are present on screen.':'Check failed: '+verified.reason});
      if(!verified.complete){run.verifications=(run.verifications||0)+1;if(run.verifications>=3)return this.finish(run,'I could not verify completion. '+verified.reason,'ask');run.progress.push({verificationFailed:verified.reason});this.emit({type:'task-progress',message:'A step is still missing. Continuing…'});continue;}
     }
     return this.finish(run,decision.answer,decision.status==='continue'?'ask':decision.status);
    }
    const label=(decision.action.type==='scroll'?context.scrollControl:context.controls.find(c=>c.id===decision.action.targetId))?.name||decision.action.value;
    if(needsReview(decision.action,context)){
     run.review={decision,context};clearTimeout(run.timer);run.timer=setTimeout(()=>this.stop('The review expired. Run the task again to read the current screen.'),Math.max(1,Math.min(55000,(context.expiresAt||Date.now()+56000)-Date.now()-1000)));
     this.emit({type:'task-review',id:run.id,label,action:decision.action.type,value:decision.action.value,answer:decision.answer,fields:context.controls.filter(c=>c.actions.includes('type')).map(c=>({name:c.name,value:c.value}))});return;
    }
    await this.execute(run,decision.action,context,false,label);
   }
  }catch(error){if(this.active(run))this.finish(run,error.message,'error');}
 }
 async execute(run,action,context,confirmed,label){
  if(!this.active(run))return;
  if(run.count>=8)return this.finish(run,'Stopped after 8 actions. Check the action log. What would you like me to do next?','ask');
  if(needsReview(action,context)&&!confirmed)throw new Error('This control requires your explicit approval.');
  this.emit({type:'task-progress',message:`${action.type}: ${label}`});
  const result=await this.act(action,context,confirmed);
  if(!this.active(run))return;
  run.count++;run.progress.push({action:action.type,target:label,value:action.type==='type'?action.value:undefined,result:'Action performed; inspect the next screen to verify outcome.'});
  if(action.type==='open_url'){run.windowId=result?.windowId||'';run.remembered=!!result?.windowId;}
  this.emit({type:'task-step',number:run.count,message:`${action.type}: ${label}`});
  this.ledger(run,{kind:'action',pass:true,message:`${action.type}: ${label}`+(action.type==='type'?` = ${JSON.stringify(action.value)}`:''),approved:!!confirmed});
  const after=await this.read(run);
  if(!this.active(run))return;
  run.nextContext=after;
  run.unchanged=screenSignature(context)===screenSignature(after)?(run.unchanged||0)+1:0;
  run.progress.at(-1).result=run.unchanged?'No observable screen change.':'The screen changed after this action.';
  if(run.unchanged>=2){
   const tried=run.progress.filter(p=>p.action).slice(-2).map(p=>`${p.action}: ${p.target}${p.value!==undefined?' = '+JSON.stringify(p.value):''}`).join('; ');
   return this.finish(run,`Stopped: the screen was unchanged after two consecutive actions. Tried: ${tried}. What would you like me to do?`,'ask');
  }
  if(run.unchanged)this.emit({type:'task-progress',message:`No screen change after ${action.type}: ${label}. One more unchanged action will stop the task.`});
 }
 async approve(id){
  const run=this.run;if(!run||run.id!==id||!run.review)throw new Error('That review has expired.');
  const{decision,context}=run.review;run.review=null;clearTimeout(run.timer);run.timer=setTimeout(()=>this.stop('Stopped after two minutes.'),120000);
  try{await this.execute(run,decision.action,context,true,(decision.action.type==='scroll'?context.scrollControl:context.controls.find(c=>c.id===decision.action.targetId))?.name||'Reviewed action');if(this.active(run))void this.loop(run);}catch(error){if(this.active(run))this.finish(run,error.message,'error');}
 }
 finish(run,answer,status){if(this.run!==run)return;clearTimeout(run.timer);run.controller.abort();this.run=null;if(status!=='error'){this.history.push({goal:run.goal,answer});this.history=this.history.slice(-6);}let storageError;try{this.record?.(run,answer,status);}catch(error){storageError=error.message;}this.emit({type:'task-finished',companion:run.companion,answer,status,actions:run.count,storageError,seconds:Math.round((Date.now()-run.startedAt)/100)/10,requests:run.requests||0,tokens:run.usage,cost:run.cost,costPartial:!!run.costPartial,model:run.lastModel,ledger:run.ledger||[]});this.restore(run,{answer,status});}
 stop(message='Task stopped. Actions already performed remain in the target app.'){if(this.run)this.finish(this.run,message,'stopped');}
}
module.exports={TaskRunner};
