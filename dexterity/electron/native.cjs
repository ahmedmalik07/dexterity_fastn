const { spawn } = require('node:child_process');
const { EventEmitter } = require('node:events');
const readline = require('node:readline');
const path = require('node:path');
class NativeBridge extends EventEmitter {
 constructor(app) {
  super(); this.requests = new Map(); this.serial = 0; this.ready = false;
  const script = app.isPackaged ? path.join(process.resourcesPath, 'native/Start-Dexterity.ps1') : path.join(__dirname, '../native/Start-Dexterity.ps1');
  const host = path.join(process.env.SystemRoot || 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  this.script=script; this.host=host; this.practiceWindows=[];
  this.process = spawn(host, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'RemoteSigned', '-File', script, '-DexterityParentPid', String(process.pid)], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  this.process.on('error', () => this.fail('Windows helper could not start. Windows PowerShell and desktop speech components are required.'));
  this.process.on('exit', () => this.fail('Windows voice and form helper stopped. Restart Dexterity.'));
  this.process.stderr.on('data', () => {});
  this.process.stdin.on('error',()=>{if(!this.closing)this.fail('Windows helper disconnected.');});
  const lines = readline.createInterface({ input: this.process.stdout });
  lines.on('line', line => {
   let message; try { message = JSON.parse(line.replace(/^\uFEFF/, '')); } catch { return; }
   if (message.id) { const request = this.requests.get(message.id); if (!request) return; clearTimeout(request.timer); this.requests.delete(message.id); message.ok ? request.resolve(message.data) : request.reject(new Error(message.error)); }
   else { if (message.type === 'ready') this.ready = true; this.emit('event', message); }
  });
 }
 fail(message) { this.ready = false; for (const request of this.requests.values()) { clearTimeout(request.timer); request.reject(new Error(message)); } this.requests.clear(); this.emit('event', { type: 'native-error', error: message }); }
 request(command, data = {}) {
  if (!this.process || this.process.killed || this.process.exitCode !== null) return Promise.reject(new Error('Windows helper is unavailable. Restart Dexterity.'));
  return new Promise((resolve, reject) => {
   const id = String(++this.serial);
   const timer = setTimeout(() => { this.requests.delete(id); reject(new Error('The target app is not responding. Try inspecting it again.')); }, 20000);
   this.requests.set(id, { resolve, reject, timer });
   this.process.stdin.write(JSON.stringify({ ...data, id, command }) + '\n', error => { if(error) { clearTimeout(timer); this.requests.delete(id); reject(new Error('Windows helper disconnected.')); } });
  });
 }
 practice() {
  const child=spawn(this.host,['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',this.script,'-TestForm'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  this.practiceWindows.push(child);
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('The practice form is taking too long to open. Try again.')),20000);child.stdout.on('data',data=>{if(data.toString().includes('FORM_READY')){clearTimeout(timer);resolve(true);}});child.stderr.on('data',()=>{});child.once('error',()=>{clearTimeout(timer);reject(new Error('The practice form could not open.'));});child.once('exit',()=>{clearTimeout(timer);reject(new Error('The practice form closed.'));});});
 }
 close() { this.closing=true;for(const child of this.practiceWindows)child.kill(); if(this.process) { this.process.stdin.end(); this.process.kill(); } }
}
module.exports = { NativeBridge };
