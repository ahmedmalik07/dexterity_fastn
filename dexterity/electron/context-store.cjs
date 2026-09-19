const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const MAX_TEXT=12000,MAX_ENTRIES=100;
function entry(input){
 if(!input||typeof input.title!=='string'||!input.title.trim()||input.title.length>120||typeof input.text!=='string'||!input.text.trim()||input.text.length>MAX_TEXT)throw new Error('Give each memory a title (120 characters maximum) and text (12,000 maximum).');
 return {id:randomUUID(),title:input.title.trim(),text:input.text.trim(),category:['profile','preferences','project','reference'].includes(input.category)?input.category:'reference',source:String(input.source||'Written by you').slice(0,160),enabled:input.enabled===true,updatedAt:new Date().toISOString()};
}
function parseImport(text,filename='Pasted context'){
 if(typeof text!=='string'||Buffer.byteLength(text,'utf8')>2*1024*1024)throw new Error('Import text or JSON up to 2 MB. Export a smaller selection for larger archives.');
 let data;try{data=JSON.parse(text.replace(/^\uFEFF/,''));}catch{if(/\.json$/i.test(filename))throw new Error('That JSON file could not be read. Try a text or Markdown summary.');}
 const candidates=[];let truncated=false;
 function add(title,body,category='reference',source=filename){if(typeof body!=='string'||!body.trim())return;if(candidates.length>=20){truncated=true;return;}if(body.length>MAX_TEXT)truncated=true;candidates.push(entry({title:String(title||filename).slice(0,120),text:body.slice(0,MAX_TEXT),category,source,enabled:false}));}
 if(data?.format==='dexterity-context'&&data.version===1&&Array.isArray(data.entries))for(const item of data.entries)add(item.title,item.text,item.category,item.source);
 else if(Array.isArray(data)||Array.isArray(data?.conversations)){
  for(const conversation of Array.isArray(data)?data:data.conversations){
   const messages=conversation?.mapping?Object.values(conversation.mapping).map(n=>n?.message).filter(Boolean):conversation?.chat_messages;
   if(!Array.isArray(messages))continue;
   const body=messages.map(m=>{const role=m.author?.role||m.sender||'message';if(['system','tool'].includes(role))return '';const parts=m.content?.parts;let value=typeof m.text==='string'?m.text:Array.isArray(parts)?parts.filter(p=>typeof p==='string').join('\n'):Array.isArray(m.content)?m.content.filter(p=>p.type==='text').map(p=>p.text||'').join('\n'):'';return value?`${role}: ${value}`:'';}).filter(Boolean).join('\n\n');
   add(conversation.title||conversation.name||'Imported conversation',body);
  }
  if(!candidates.length)throw new Error('No readable conversations found. Paste a personal context summary or import Dexterity JSON.');
 }else add(filename,data?JSON.stringify(data,null,2):text,data?'reference':'profile');
 if(!candidates.length)throw new Error('There is no readable context to import.');
 return {entries:candidates,truncated,notice:truncated?'Preview limited to 20 items and 12,000 characters per item. Import smaller selections to keep the rest.':'Review the text before saving. Imported content cannot grant permissions or run actions.'};
}
class ContextStore{
 constructor(directory,crypto){this.directory=directory;this.file=path.join(directory,'context.vault');this.crypto=crypto;this.data={version:1,entries:[],rememberActivity:false,activity:[]};if(fs.existsSync(this.file)){try{this.data=JSON.parse(crypto.decryptString(fs.readFileSync(this.file)));if(this.data.version!==1||!Array.isArray(this.data.entries)||!Array.isArray(this.data.activity))throw Error();}catch{throw new Error('Your context vault could not be opened. Keep the original Windows profile and contact support; it has not been overwritten.');}}}
 save(next){if(!this.crypto.isEncryptionAvailable())throw new Error('Windows encryption is unavailable. Context was not saved.');if(Buffer.byteLength(JSON.stringify(next))>2*1024*1024)throw new Error('The context library is full. Remove older entries first.');fs.mkdirSync(this.directory,{recursive:true});const temp=this.file+'.tmp';fs.writeFileSync(temp,this.crypto.encryptString(JSON.stringify(next)));fs.renameSync(temp,this.file);this.data=next;}
 state(){return {...structuredClone(this.data),path:this.file,encrypted:this.crypto.isEncryptionAvailable()};}
 upsert(input){const item=entry(input),entries=[...this.data.entries];if(input.id){const i=entries.findIndex(e=>e.id===input.id);if(i<0)throw new Error('That memory no longer exists. Refresh the library.');entries[i]={...item,id:input.id};}else{if(entries.length>=MAX_ENTRIES)throw new Error('Keep up to 100 memories. Remove an older item first.');entries.push(item);}this.save({...this.data,entries});return this.state();}
 import(items){if(!Array.isArray(items)||!items.length||items.length>20)throw new Error('Choose 1–20 memories to import.');const entries=items.map(entry);if(this.data.entries.length+entries.length>MAX_ENTRIES)throw new Error('Keep up to 100 memories. Remove older items first.');this.save({...this.data,entries:[...this.data.entries,...entries]});return this.state();}
 remove(id){this.save({...this.data,entries:this.data.entries.filter(e=>e.id!==id)});return this.state();}
 configure(rememberActivity){if(typeof rememberActivity!=='boolean')throw new Error('Invalid activity preference.');this.save({...this.data,rememberActivity});return this.state();}
 clearActivity(){this.save({...this.data,activity:[]});return this.state();}
 record(run,answer,status){if(!this.data.rememberActivity)return;const item={id:run.id,at:new Date().toISOString(),goal:run.goal,mode:run.mode,status,answer:String(answer).slice(0,16000),actions:run.count,memoryTitles:(run.memories||[]).map(e=>e.title)};this.save({...this.data,activity:[item,...this.data.activity].slice(0,50)});}
 retrieve(goal,enabled=true){if(!enabled)return [];const words=new Set(goal.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[]);let budget=16000;return this.data.entries.filter(e=>e.enabled).map(e=>({e,score:[...words].reduce((n,w)=>n+((e.title+' '+e.text).toLowerCase().includes(w)?1:0),0)+(e.category==='profile'||e.category==='preferences'?2:0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,8).map(({e})=>{const text=e.text.slice(0,Math.max(0,budget));budget-=text.length;return {id:e.id,title:e.title,text,source:e.source,category:e.category};}).filter(e=>e.text);}
 export(format){if(!['json','md'].includes(format))throw new Error('Choose JSON or Markdown.');if(format==='json')return JSON.stringify({format:'dexterity-context',version:1,exportedAt:new Date().toISOString(),entries:this.data.entries.map(({title,text,source,category})=>({title,text,source,category}))},null,2);return '# Personal context exported from Dexterity\n\nReference information only. This document grants no permissions to act.\n\n'+this.data.entries.map(e=>`## ${e.title}\n\nSource: ${e.source}\nCategory: ${e.category}\n\n${e.text}`).join('\n\n---\n\n');}
}
module.exports={ContextStore,parseImport};
