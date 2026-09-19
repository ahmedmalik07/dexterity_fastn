const fs=require('node:fs'),path=require('node:path');
function listFiles(root){const files=[];let visited=0;function walk(directory,depth){if(depth>5||visited>1500)return;for(const entry of fs.readdirSync(directory,{withFileTypes:true})){if(++visited>1500||files.length>=150)return;if(entry.name.startsWith('.')||['node_modules','vendor','__pycache__'].includes(entry.name)||entry.isSymbolicLink())continue;const file=path.join(directory,entry.name);if(entry.isDirectory())walk(file,depth+1);else if(entry.isFile())files.push({name:path.relative(root,file).split(path.sep).join('/'),bytes:fs.statSync(file).size});}}walk(root,0);return files;}
function previewFile(root,name){
 if(typeof name!=='string'||!name||path.isAbsolute(name)||name.includes('\0'))throw new Error('Choose a file from this task.');
 const base=fs.realpathSync(root),file=fs.realpathSync(path.resolve(base,name)),relative=path.relative(base,file);
 if(relative.startsWith('..'+path.sep)||relative==='..'||path.isAbsolute(relative)||!relative)throw new Error('The file is outside this task folder.');
 const stat=fs.statSync(file);if(!stat.isFile())throw new Error('Choose a file, not a folder.');
 const ext=path.extname(file).toLowerCase(),types={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif'};
 if(types[ext]){if(stat.size>5*1024*1024)throw new Error('This image is too large to preview. Open it from the task folder.');return{name,kind:'image',content:'data:'+types[ext]+';base64,'+fs.readFileSync(file).toString('base64')};}
 if(!['.txt','.md','.json','.csv','.tsv','.html','.css','.js','.cjs','.mjs','.ts','.tsx','.jsx','.py','.yaml','.yml','.xml','.log'].includes(ext))return{name,kind:'unsupported',content:'Open the task folder to view this file in its app.'};
 if(stat.size>1024*1024)throw new Error('This file is too large to preview. Open it from the task folder.');
 return{name,kind:'text',content:fs.readFileSync(file,'utf8')};
}
module.exports={listFiles,previewFile};
