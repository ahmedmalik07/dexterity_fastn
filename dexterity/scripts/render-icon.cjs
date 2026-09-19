const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
app.setPath('userData',path.join(app.getPath('temp'),'dexterity-icon-'+process.pid));
app.whenReady().then(async()=>{
 try {
  const window=new BrowserWindow({show:false,width:256,height:256,webPreferences:{contextIsolation:true,sandbox:true}});
  await window.loadFile(path.join(__dirname,'../ui/dexterity-mark.svg'));
  const data=await window.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{const canvas=document.createElementNS('http://www.w3.org/1999/xhtml','canvas');canvas.width=256;canvas.height=256;canvas.getContext('2d').drawImage(image,0,0,256,256);resolve(canvas.toDataURL('image/png').split(',')[1]);};image.onerror=reject;image.src=location.href;})`);
  const png=Buffer.from(data,'base64');fs.writeFileSync(path.join(__dirname,'../ui/icon.png'),png);
  const header=Buffer.alloc(22);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(png.length,14);header.writeUInt32LE(22,18);
  fs.writeFileSync(path.join(__dirname,'../ui/icon.ico'),Buffer.concat([header,png]));
  console.log('Generated Dexterity PNG and Windows ICO from the vector mark.'); app.quit();
 }catch(error){console.error(error);app.exit(1);}
});
