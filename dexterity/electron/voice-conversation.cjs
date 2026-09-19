const {randomUUID}=require('node:crypto');
// A reply acknowledgement belongs to one session and one turn. Stale audio events
// must never reopen the microphone after Stop or after a different conversation.
class VoiceConversation {
 constructor({listen,emit,onExpire=()=>{},limitMs=600000}){Object.assign(this,{listen,emit,onExpire,limitMs});this.session=null;}
 state(){return this.session?{active:true,id:this.session.id,phase:this.session.phase}:{active:false,phase:'off'};}
 publish(){this.emit({type:'voice-conversation',...this.state()});}
 async start(){
  this.stop();const session={id:randomUUID(),phase:'listening',reply:null};this.session=session;
  session.timer=setTimeout(()=>{this.stop('Hands-free ended after ten minutes. Start it again when you’re ready.');this.onExpire();},this.limitMs);this.publish();
  try{await this.listen();}catch(error){if(this.session===session)this.stop(error.message);throw error;}
  return this.state();
 }
 listening(){if(this.session){this.session.phase='listening';this.session.reply=null;this.publish();}}
 thinking(){if(this.session){this.session.phase='thinking';this.session.reply=null;this.publish();}}
 reply(){if(!this.session)return null;this.session.phase='speaking';this.session.reply=randomUUID();this.publish();return this.session.reply;}
 async heardReply(token){
  const session=this.session;if(!session||!token||session.reply!==token||session.phase!=='speaking')return false;
  session.reply=null;session.phase='listening';this.publish();
  try{await this.listen();}catch(error){if(this.session===session)this.stop(error.message);throw error;}
  return true;
 }
 stop(reason){if(this.session)clearTimeout(this.session.timer);this.session=null;this.emit({type:'voice-conversation',active:false,phase:'off',reason});}
}
module.exports={VoiceConversation};
