// Credentials enter through stdin only and are saved with the app's Windows profile encryption.
const{_electron:electron}=require('@playwright/test');
(async()=>{let desktop;try{
 const key=(await new Promise(resolve=>require('node:readline').createInterface({input:process.stdin}).once('line',resolve))).trim();
 const response=await fetch('https://openrouter.ai/api/v1/key',{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('OpenRouter rejected the key (HTTP '+response.status+').');
 const env={...process.env,DEXTERITY_SETUP:'1'};delete env.ELECTRON_RUN_AS_NODE;delete env.DEXTERITY_TEST;desktop=await electron.launch({args:['.'],env});await desktop.firstWindow();
 let page;for(let i=0;i<100;i++){page=desktop.windows().find(p=>p.url().endsWith('/index.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}
 await page.waitForFunction(()=>typeof prefs!=='undefined'&&prefs);await page.evaluate(async key=>{if(!prefs.encrypted)throw new Error('Windows encryption unavailable');await api.saveSettings({...prefs,routerKey:key,routerModel:'google/gemini-2.5-flash',speechMode:'auto',speechPause:1200});},key);
 console.log('OpenRouter key validated and saved with Windows encryption.');
}catch(error){console.error(error.message);process.exitCode=1;}finally{if(desktop)await desktop.close();process.exit(process.exitCode||0);}})();
