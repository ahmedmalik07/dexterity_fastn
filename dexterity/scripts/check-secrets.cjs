// Scan the exact Git index before publishing; print filenames only, never matching secrets.
const{execFileSync}=require('node:child_process');
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);let failed=false;
const patterns=[/\bsk-or-v1-[a-f0-9]{40,}/i,/\bsk-(?:proj-)?[A-Za-z0-9_-]{30,}/,/\bAIza[A-Za-z0-9_-]{30,}/,/\bAQ\.[A-Za-z0-9_-]{30,}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/];
for(const file of files){if(/(^|\/)(?:preferences\.json|\.env(?:\..*)?)$|\.vault(?:\.tmp)?$/.test(file)){console.error('Private data file staged: '+file);failed=true;continue;}if(!/\.(?:cjs|js|json|md|txt|ps1|cmd|html|css|ya?ml)$/.test(file))continue;const text=execFileSync('git',['show',':'+file],{encoding:'utf8',maxBuffer:4*1024*1024});if(patterns.some(p=>p.test(text))){console.error('Possible credential staged: '+file);failed=true;}}
if(failed)process.exit(1);console.log('PASS: '+files.length+' staged files checked; no private data files or recognized credentials.');
