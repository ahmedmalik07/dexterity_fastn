const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const{ConversationHistory}=require('../electron/conversation-history.cjs'),{listFiles,previewFile}=require('../electron/job-files.cjs');
const crypto={isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from(s).toString('base64'),decryptString:b=>Buffer.from(b.toString(),'base64').toString()};
function directory(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dexterity-history-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
test('history is opt-in, encrypted through adapter, reloadable and deletable',t=>{
 const dir=directory(t),history=new ConversationHistory(dir,crypto),run={goal:'Teach me color',rootGoal:'Teach me color',mode:'teach',screen:true,image:'must-not-save'};
 history.append(run,'Open the color tab','done');assert.equal(fs.existsSync(history.file),false);
 history.configure(true);history.append(run,'Open the color tab','done');const id=history.current().id;assert.equal(history.current().turns[0].image,undefined);assert.ok(!fs.readFileSync(history.file,'utf8').includes('Open the color tab'));
 const again=new ConversationHistory(dir,crypto);assert.equal(again.context()[0].answer,'Open the color tab');assert.equal(again.anchor().mode,'teach');again.fresh();assert.deepEqual(again.context(),[]);again.select(id);again.configure(false);again.append(run,'Not saved','done');assert.equal(again.current().turns.length,1);again.remove(id);assert.deepEqual(again.state().chats,[]);
});
test('history corruption is preserved instead of overwritten',t=>{const dir=directory(t),file=path.join(dir,'conversations.vault');fs.writeFileSync(file,'broken');assert.throws(()=>new ConversationHistory(dir,crypto),/preserved/);assert.equal(fs.readFileSync(file,'utf8'),'broken');});
test('file preview reads task outputs and rejects traversal and oversized files',t=>{
 const dir=directory(t),root=path.join(dir,'job');fs.mkdirSync(root);fs.writeFileSync(path.join(root,'result.md'),'# Finished');fs.writeFileSync(path.join(dir,'outside.txt'),'private');fs.mkdirSync(path.join(root,'node_modules'));fs.writeFileSync(path.join(root,'node_modules','ignore.txt'),'ignore');
 assert.equal(listFiles(root).length,1);assert.equal(previewFile(root,'result.md').content,'# Finished');assert.throws(()=>previewFile(root,'../outside.txt'),/outside/);fs.writeFileSync(path.join(root,'large.txt'),Buffer.alloc(1024*1024+1));assert.throws(()=>previewFile(root,'large.txt'),/too large/);
});
