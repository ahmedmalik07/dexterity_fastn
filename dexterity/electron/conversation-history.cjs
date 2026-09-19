const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
class ConversationHistory{
 constructor(directory,crypto){this.directory=directory;this.crypto=crypto;this.file=path.join(directory,'conversations.vault');this.data={version:1,enabled:false,current:null,chats:[]};if(fs.existsSync(this.file)){try{const data=JSON.parse(crypto.decryptString(fs.readFileSync(this.file)));if(data.version!==1||!Array.isArray(data.chats))throw Error();this.data=data;}catch{throw new Error('Saved conversations could not be decrypted. The existing file has been preserved.');}}}
 save(next){if(!this.crypto.isEncryptionAvailable())throw new Error('Windows encryption is unavailable. Conversation history was not saved.');const text=JSON.stringify(next);if(Buffer.byteLength(text)>4*1024*1024)throw new Error('Conversation history is full. Delete older conversations to make room.');fs.mkdirSync(this.directory,{recursive:true});fs.writeFileSync(this.file+'.tmp',this.crypto.encryptString(text));fs.renameSync(this.file+'.tmp',this.file);this.data=next;}
 state(){return structuredClone(this.data);}
 configure(enabled){if(typeof enabled!=='boolean')throw new Error('Choose whether to remember conversations.');this.save({...this.data,enabled});return this.state();}
 current(){return this.data.chats.find(c=>c.id===this.data.current)||null;}
 context(){return (this.current()?.turns||[]).filter(t=>['done','ask'].includes(t.status)).slice(-6).map(({goal,answer})=>({goal,answer}));}
 anchor(){const turn=this.current()?.turns.at(-1);return turn?{mode:turn.mode,rootGoal:turn.rootGoal,screen:turn.screen}:null;}
 append(run,answer,status){if(!this.data.enabled)return;const next=this.state();let chat=next.chats.find(c=>c.id===next.current);if(!chat){chat={id:randomUUID(),title:run.rootGoal||run.goal,createdAt:Date.now(),turns:[]};next.current=chat.id;next.chats.unshift(chat);}chat.updatedAt=Date.now();chat.turns.push({goal:run.goal,rootGoal:run.rootGoal||run.goal,answer,status,mode:run.mode,screen:run.screen,at:Date.now()});chat.turns=chat.turns.slice(-100);next.chats=next.chats.slice(0,50);this.save(next);}
 select(id){if(!this.data.chats.some(c=>c.id===id))throw new Error('That conversation was not found.');this.save({...this.data,current:id});return this.current();}
 fresh(){if(this.data.current)this.save({...this.data,current:null});return true;}
 remove(id){if(!this.data.chats.some(c=>c.id===id))throw new Error('That conversation was not found.');this.save({...this.data,current:this.data.current===id?null:this.data.current,chats:this.data.chats.filter(c=>c.id!==id)});return this.state();}
}
module.exports={ConversationHistory};
