const{app,BrowserWindow}=require('electron'),path=require('node:path');
app.setPath('userData',path.join(app.getPath('temp'),'dexterity-editor-test-'+process.pid));
app.whenReady().then(()=>{const window=new BrowserWindow({width:1000,height:700,title:'Sample photo editor',webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});window.loadFile(path.join(__dirname,'editor-scene.html'));});
app.on('window-all-closed',()=>app.quit());
