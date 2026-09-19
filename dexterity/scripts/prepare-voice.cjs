const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),dest=path.join(root,'ui/vendor/voice');fs.mkdirSync(dest,{recursive:true});
for(const[pkg,files]of [['@ricky0123/vad-web',['dist/bundle.min.js','dist/bundle.min.js.LICENSE.txt','dist/vad.worklet.bundle.min.js','dist/silero_vad_v5.onnx']],['onnxruntime-web',['dist/ort.wasm.min.js','dist/ort-wasm-simd-threaded.mjs','dist/ort-wasm-simd-threaded.wasm']]])for(const file of files){const src=path.join(root,'node_modules',pkg,file);fs.copyFileSync(src,path.join(dest,path.basename(file)));}
console.log('Local speech detector assets ready. No runtime CDN requests.');
