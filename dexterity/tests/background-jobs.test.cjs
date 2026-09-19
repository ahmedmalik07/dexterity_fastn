const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{EventEmitter}=require('node:events'),{PassThrough}=require('node:stream');
const{BackgroundJobs}=require('../electron/background-jobs.cjs');
const encryption={isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from(s),decryptString:b=>b.toString()};
function fixture(t){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'dexterity-jobs-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));const children=[],calls=[];const manager=new BackgroundJobs({directory,encryption,runtime:()=>'/fixture/codex',launch:(exe,args,options)=>{const child=new EventEmitter();Object.assign(child,{stdin:new PassThrough(),stdout:new PassThrough(),stderr:new PassThrough(),kill:()=>child.emit('close',1)});children.push(child);calls.push({exe,args,options});return child;}});return{manager,children,calls,directory};}
test('background jobs stream progress, persist completed results, and keep separate folders',t=>{
 const{manager,children,calls,directory}=fixture(t);const a=manager.start('Build a timer'),b=manager.start('Research screen design');assert.notEqual(calls[0].options.cwd,calls[1].options.cwd);assert.ok(calls[0].args.includes('workspace-write'));assert.equal(calls[0].options.windowsHide,true);assert.throws(()=>manager.start('Third task'),/Two background/);
 children[0].stdout.write(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Created index.html'}})+'\n');children[0].stdout.write('{"type":"turn.completed"}\n');children[0].emit('close',0);assert.equal(manager.get(a.id).status,'done');assert.equal(manager.get(a.id).result,'Created index.html');
 const reopened=new BackgroundJobs({directory,encryption});assert.equal(reopened.get(a.id).status,'done');assert.equal(reopened.get(b.id).status,'interrupted');
});
test('missing runtime, process failures, and cancellation never report success',t=>{
 const{manager,children}=fixture(t);const job=manager.start('Make a note');children[0].emit('error',new Error('Sign in required'));assert.equal(manager.get(job.id).status,'error');assert.match(manager.get(job.id).result,/Sign in/);
 const next=manager.start('Try again',job.id);assert.equal(next.id,job.id);manager.stop(job.id);assert.equal(manager.get(job.id).status,'stopped');
 manager.runtime=()=>null;assert.throws(()=>manager.start('Task'),/Install and sign in/);assert.throws(()=>manager.folder('../outside'),/not found/);
});
