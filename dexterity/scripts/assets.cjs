const { spawn }=require('node:child_process');
const path=require('node:path');
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(require('electron'),[path.join(__dirname,'render-icon.cjs')],{env,windowsHide:true,stdio:'inherit'});
child.on('exit',code=>process.exit(code||0));
//script.js
