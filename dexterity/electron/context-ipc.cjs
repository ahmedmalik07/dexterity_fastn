const {ipcMain,dialog,shell}=require('electron'),fs=require('node:fs'),path=require('node:path');
const {parseImport}=require('./context-store.cjs');
function registerContextIPC({app,main,getStore,busy}){
 const handle=(name,fn,mutation=false)=>ipcMain.handle('context:'+name,async(event,...args)=>{if(event.sender!==main.webContents)throw new Error('Open My context in the main Dexterity window.');if(mutation&&busy())throw new Error('Finish or stop the current task before changing context.');return fn(...args);});
 handle('get',()=>getStore().state());
 handle('save',input=>getStore().upsert(input),true);
 handle('remove',id=>getStore().remove(id),true);
 handle('import',items=>getStore().import(items),true);
 handle('preview',text=>parseImport(text,'Pasted context'));
 handle('select-file',async()=>{const result=await dialog.showOpenDialog(main,{title:'Import context from another assistant',properties:['openFile'],filters:[{name:'Context and conversation exports',extensions:['txt','md','json']}]});if(result.canceled)return null;const file=result.filePaths[0];if(!/\.(txt|md|json)$/i.test(file)||fs.statSync(file).size>2*1024*1024)throw new Error('Choose a text, Markdown, or JSON file under 2 MB.');return parseImport(fs.readFileSync(file,'utf8'),path.basename(file));});
 handle('export',async format=>{const body=getStore().export(format);const result=await dialog.showSaveDialog(main,{title:'Export readable personal context — keep this file private',defaultPath:path.join(app.getPath('documents'),'dexterity-context.'+format),filters:[{name:format==='md'?'Markdown':'Dexterity JSON',extensions:[format]}]});if(result.canceled||!result.filePath)return null;fs.writeFileSync(result.filePath,body,'utf8');return {path:result.filePath};});
 handle('configure',value=>getStore().configure(value),true);
 handle('clear-activity',()=>getStore().clearActivity(),true);
 handle('folder',()=>shell.openPath(app.getPath('userData')));
}
module.exports={registerContextIPC};
