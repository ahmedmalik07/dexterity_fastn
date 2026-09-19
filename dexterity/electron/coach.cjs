const{ipcMain,screen}=require('electron');
const{toScreenPoint}=require('./core.cjs');
function createCoach({main,coach,pointer,native,broadcast,busy,hidePointer,startListening,ask,settings=()=>({voice:false}),voiceConversation}){
 let lesson=null,pointerTimer,lastCard=null;
 function position(){const p=screen.getCursorScreenPoint(),area=screen.getDisplayNearestPoint(p).workArea;const b=coach.getBounds();coach.setPosition(Math.max(area.x,Math.min(p.x+60,area.x+area.width-b.width)),Math.max(area.y,Math.min(p.y+30,area.y+area.height-b.height)));}
 function show(data){lastCard=data;position();coach.webContents.send('coach:update',data);coach.showInactive();}
 async function point(){
  if(busy())throw new Error('Wait until the current step finishes.');
  if(!lesson?.target||Date.now()-lesson.timestamp>60000)throw new Error('Read the screen again to get a fresh click marker.');
  const{context,target}=lesson;
  if(context.windowId){const fresh=await native.request('focus',{windowId:context.windowId,title:context.title});if(JSON.stringify(fresh.bounds)!==JSON.stringify(context.bounds))throw new Error('The app moved or changed size. Read the screen again.');}
  if(coach.isDestroyed()||pointer.isDestroyed())return false;
  const p=toScreenPoint({x:target.x,y:target.y},context.captureBounds);if(!p)throw new Error('No reliable target available. Read the screen again.');
  const area=screen.getDisplayNearestPoint(p).bounds;
  hidePointer();clearTimeout(pointerTimer);main.hide();pointer.setBounds(area);pointer.webContents.send('point:data',{x:p.x-area.x,y:p.y-area.y,title:target.label,overlay:true});pointer.showInactive();pointerTimer=setTimeout(()=>pointer.hide(),12000);return true;
 }
 ipcMain.handle('coach:point',point);
 ipcMain.handle('coach:next',()=>{if(busy())throw new Error('Wait for the current step.');if(!lesson||lesson.mode!=='teach')throw new Error('Start a lesson first.');return ask('I did that. Read my current screen, check progress, and teach me one next step.');});
 ipcMain.handle('coach:hide',()=>{voiceConversation?.stop();coach.hide();hidePointer();clearTimeout(pointerTimer);});
 ipcMain.handle('coach:listen',()=>startListening());
 return{
  reset(){lesson=null;lastCard=null;hidePointer();},
  restoreConversation(chat){lesson=null;hidePointer();const turn=chat.turns.at(-1);lastCard=turn?{answer:turn.answer,goal:turn.rootGoal||turn.goal,busy:false,provider:'Saved conversation'}:null;show(lastCard||{answer:'What would you like to work on?',busy:false});coach.show();coach.focus();},
  conversation(){return lesson?{rootGoal:lesson.rootGoal,mode:lesson.mode,screen:lesson.screen,windowId:lesson.context?.windowId||''}:null;},
  background(job){main.hide();show({answer:'I’ve started that in the background. You can keep talking to me. Open Background tasks from the workspace to see its progress and files.',goal:job.goal,busy:false,provider:'Dexterity agent',speak:settings().voice,replyToken:voiceConversation?.reply()});},
  open(){show(lastCard||{answer:'Hey. What are you working on?',busy:false});coach.show();coach.focus();},
  progress(event,run){if(run?.companion&&['task-start','task-progress','task-role'].includes(event.type)){if(event.type==='task-start'){main.hide();show({busy:true,answer:'Thinking…',goal:run.goal});}else coach.webContents.send('coach:update',{busy:true,answer:event.message||'Thinking…'});}},
  finish(run,result){const ready=['done','ask'].includes(result.status);if(!ready)voiceConversation?.stop();lesson={rootGoal:run.rootGoal||run.goal,mode:run.mode,screen:run.screen,context:run.observation,target:ready?run.lastDecision?.target:null,timestamp:run.observation?.capturedAt||Date.now()};broadcast({type:'guide-ready',available:!!lesson.target});if(run.companion){main.hide();show({answer:result.answer,goal:run.rootGoal||run.goal,busy:false,teach:run.mode==='teach'&&ready,target:lesson.target,provider:run.lastDecision?.provider,status:result.status,speak:settings().voice&&ready,replyToken:ready?voiceConversation?.reply():null});if(lesson.target)point().catch(error=>{if(!coach.isDestroyed())coach.webContents.send('coach:notice',error.message);});}else main.show();},
  hide(){coach.hide();},dispose(){clearTimeout(pointerTimer);}
 };
}
module.exports={createCoach};
