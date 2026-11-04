// Fictional fixtures only; VITE_SOCIAL_V2_ENABLED=true Vite on port 5182.
const {spawn}=require('node:child_process');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const WebSocket=require('ws');
const out='/tmp/movenotes-equipment-previews';fs.mkdirSync(out,{recursive:true});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'movenotes-social-browser-'));
const browser=spawn(process.env.CHROME_BIN||'/home/thijs/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',['--no-sandbox','--disable-gpu','--headless','--remote-debugging-port=9256',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let ws;let checks=0;
(async()=>{
 let targets;for(let i=0;i<60;i++){try{targets=await(await fetch('http://127.0.0.1:9256/json/list')).json();if(targets.length)break;}catch{}await delay(100);}
 if(!targets?.length)throw Error('Chromium unavailable');
 ws=new WebSocket(targets[0].webSocketDebuggerUrl);await new Promise(r=>ws.once('open',r));
 let next=0;const pending=new Map();const errors=[];
 ws.on('message',raw=>{const m=JSON.parse(String(raw));if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async expression=>{for(let i=0;i<150;i++){if(await evaluate(expression)){checks++;return;}await delay(40);}throw Error(`Timeout: ${expression}\n${await evaluate('document.body.innerText')}\n${JSON.stringify(errors)}`);};
 const click=async text=>{await evaluate(`(()=>{const b=[...document.querySelectorAll('button,a')].find(b=>!b.closest('[inert]')&&(b.textContent.trim()===${JSON.stringify(text)}||b.getAttribute('aria-label')===${JSON.stringify(text)}));if(!b||b.disabled)throw Error('Unavailable button: '+${JSON.stringify(text)}+' | '+document.body.innerText);b.focus();b.click();})()`);await delay(100);};
 const openThread=async()=>{if(await evaluate("[...document.querySelectorAll('button')].some(b=>!b.closest('[inert]')&&b.textContent.trim()==='Comments and reactions')"))await click('Comments and reactions');else await click('Open activity conversation');};
 const choose=async name=>{await evaluate(`window.formQA.select(${JSON.stringify(name)})`);await delay(180);};
 const fill=async(selector,value)=>{await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing input '+${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);await delay(80);};
 const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(r.data,'base64'));};
 const layout=async()=>{await wait('document.documentElement.scrollWidth<=window.innerWidth+1');await wait("[...document.querySelectorAll('[aria-modal=true]')].every(e=>e.getBoundingClientRect().bottom<=window.innerHeight+1)");};

 await send('Runtime.enable');await send('Page.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await send('Page.navigate',{url:'http://127.0.0.1:5182/scripts/form-qa/index.html'});await wait('!!window.formQA');
 await evaluate("window.formQA.setEquipmentAssignments({'equipment-0':['walk'],'equipment-1':['walk']})");
 await choose('log');
 await wait("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Walking shoes')");
 await click('Walking shoes');await wait("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Walking shoes')?.getAttribute('aria-pressed')==='true'");
 await click('Walking shoes');await wait("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Walking shoes')?.getAttribute('aria-pressed')==='false'");
 await click('Walking shoes');await click('All equipment');
 await wait("!!document.querySelector('section[aria-label=\"For Walk\"]')&&!!document.querySelector('section[aria-label=\"Other equipment\"]')");
 await wait("document.querySelector('section[aria-label=\"For Walk\"]').textContent.includes('Walking shoes')&&!document.querySelector('section[aria-label=\"Other equipment\"]').textContent.includes('Walking shoes')");

 await wait("[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Fictional equipment 45'))");
 await click('Fictional equipment 3');await click('Done');
 await wait("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Fictional equipment 3'&&b.getAttribute('aria-pressed')==='true')");
 await layout();await shot('quick-log-equipment-mobile');
 await choose('import');await click('Walking shoes');
 await wait("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Walking shoes')?.getAttribute('aria-pressed')==='true'");
 await click('Save details');
 await wait("window.formQA.writes.some(w=>w.table==='activity_equipment'&&JSON.stringify(w.payload||[]).includes('equipment-0'))");
 await choose('equipment-page');await click('Edit Walking shoes');
 await wait("document.body.innerText.includes('Choose where this equipment should be suggested')");
 await evaluate("(()=>{for(const label of document.querySelectorAll('label'))if(['Run','Walk'].includes(label.textContent.trim())){const input=label.querySelector('input');if(!input.checked)input.click();}})()");
 await click('Save changes');
 await wait("window.formQA.writes.some(w=>w.table==='equipment'&&w.payload?.activity_types?.includes('run')&&w.payload?.activity_types?.includes('walk'))");
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await choose('log');await layout();await shot('quick-log-equipment-desktop');
 if(await evaluate('window.formQA.network.length'))throw Error('Unexpected Supabase network request');
 if(errors.length)throw Error(JSON.stringify(errors));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{ws?.close();browser.kill();fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});console.log(`Equipment browser assertions: ${checks}; screenshots: ${out}`);});
