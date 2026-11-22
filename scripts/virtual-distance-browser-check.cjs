// Fictional fixtures only; VITE_SOCIAL_V2_ENABLED=true Vite on port 5182.
const {spawn}=require('node:child_process');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const WebSocket=require('ws');
const out='/tmp/movenotes-virtual-previews';fs.mkdirSync(out,{recursive:true});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'movenotes-social-browser-'));
const browser=spawn(process.env.CHROME_BIN||'/home/thijs/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',['--no-sandbox','--disable-gpu','--headless','--remote-debugging-port=9258',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let ws;let checks=0;
(async()=>{
 let targets;for(let i=0;i<60;i++){try{targets=await(await fetch('http://127.0.0.1:9258/json/list')).json();if(targets.length)break;}catch{}await delay(100);}
 if(!targets?.length)throw Error('Chromium unavailable');
 ws=new WebSocket(targets[0].webSocketDebuggerUrl);await new Promise(r=>ws.once('open',r));
 let next=0;const pending=new Map();const errors=[];
 ws.on('message',raw=>{const m=JSON.parse(String(raw));if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async expression=>{for(let i=0;i<400;i++){if(await evaluate(expression)){checks++;return;}await delay(40);}throw Error(`Timeout: ${expression}\n${await evaluate('document.body.innerText')}\n${JSON.stringify(errors)}`);};
 const click=async text=>{await evaluate(`(()=>{const b=[...document.querySelectorAll('button,a,summary')].find(b=>!b.closest('[inert]')&&(b.textContent.trim()===${JSON.stringify(text)}||b.getAttribute('aria-label')===${JSON.stringify(text)}));if(!b||b.disabled)throw Error('Unavailable button: '+${JSON.stringify(text)}+' | '+document.body.innerText);b.focus();b.click();})()`);await delay(100);};
 const openThread=async()=>{if(await evaluate("[...document.querySelectorAll('button')].some(b=>!b.closest('[inert]')&&b.textContent.trim()==='Comments and reactions')"))await click('Comments and reactions');else await click('Open activity conversation');};
 const choose=async name=>{await evaluate(`window.formQA.select(${JSON.stringify(name)})`);await delay(180);};
 const fill=async(selector,value)=>{await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing input '+${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);await delay(80);};
 const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(r.data,'base64'));};
 const layout=async()=>{await wait('document.documentElement.scrollWidth<=window.innerWidth+1');await wait("[...document.querySelectorAll('[aria-modal=true]')].every(e=>e.getBoundingClientRect().bottom<=window.innerHeight+1)");};

 await send('Runtime.enable');await send('Page.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await send('Page.navigate',{url:'http://127.0.0.1:5182/scripts/form-qa/index.html'});await wait('!!window.formQA');
 await choose('journey-create');
 await wait("document.body.innerText.includes('All Community members participate automatically')");
 await wait("document.querySelector('select[id$=metric]').value==='virtual_distance'");
 await fill('input[id$=title]','Our shared adventure');
 await fill('input[id$=target]','20');
 await evaluate("[...document.querySelectorAll('label')].find(e=>e.textContent==='Choose specific types').querySelector('input').click()");
 await wait("[...document.querySelectorAll('button')].find(e=>e.textContent==='Start challenge').disabled");
 await evaluate("[...document.querySelectorAll('label')].find(e=>e.textContent==='Run').querySelector('input').click()");
 await fill('select[id$=metric]','distance');await fill('select[id$=metric]','virtual_distance');
 await wait("[...document.querySelectorAll('label')].find(e=>e.textContent==='Run').querySelector('input').checked");
 await layout();await shot('journey-create-mobile');
 await click('Start challenge');
 await wait("window.formQA.writes.some(w=>w.table==='social_challenges'&&w.payload.p_data.metric==='virtual_distance'&&w.payload.p_data.target==='20.000000000000'&&w.payload.p_data.activity_scope==='selected'&&w.payload.p_data.types.includes('run'))");
 await evaluate("window.formQA.setUnits('imperial')");await choose('journey-create');
 await fill('input[id$=title]','Miles together');await fill('input[id$=target]','10');
 await click('Start challenge');
 await wait("window.formQA.writes.some(w=>w.table==='social_challenges'&&w.payload.p_data.target==='16.093440000000')");
 await choose('journey-details');await wait("document.body.innerText.includes('A quiet run')");
 await evaluate("[...document.querySelectorAll('summary')].find(e=>e.textContent.includes('A quiet run')).click()");
 await wait("document.body.innerText.includes('× 2.25')&&document.body.innerText.includes('pace and effort rating do not change')&&!document.body.innerText.includes('default effort')");

 await click('How activities become virtual distance');
 await wait("document.body.innerText.includes('0.62 virtual miles')");await shot('journey-explanation-mobile');
 await choose('challenge-create');await wait("document.querySelector('select[id$=metric]').value==='count'");
 await evaluate('window.formQA.setChallengeDemo();window.formQA.setChallengeCompleted()');await choose('challenge-edit');
 await wait("document.body.innerText.includes('Close challenge')&&!document.body.innerText.includes('journey')");
 await click('Close challenge');await wait("document.body.innerText.includes('Later movement will no longer count')");
 await evaluate("[...document.querySelectorAll('button')].filter(e=>!e.closest('[inert]')&&e.textContent.trim()==='Close challenge').at(-1).click()");
 await wait("window.formQA.writes.some(w=>w.table==='social_challenges'&&w.payload.p_action==='close')");
 await choose('social-page');await click('Brussels Runners');
 await wait("!!document.querySelector('article[aria-label=\"Challenge: Around the world together\"]')");
 await wait("[...document.querySelectorAll('section')].filter(e=>e.textContent.includes('Our challenges')).every(e=>!e.querySelector('article[aria-label^=\"Challenge:\"]'))");
 await shot('archived-challenge-mobile');


 await evaluate('window.formQA.setEquipmentUsage()');await choose('equipment-page');
 await wait("document.querySelector('[aria-label=\"Edit Walking shoes\"]').textContent.includes('1 walk')&&document.querySelector('[aria-label=\"Edit Walking shoes\"]').textContent.includes('about')");
 await shot('equipment-stats-mobile');await click('Edit Walking shoes');
 await wait("(()=>{const d=document.querySelector('[aria-modal=true]');const t=d.innerText;return t.indexOf('Name')<t.indexOf('Notes (optional)')&&t.indexOf('Notes (optional)')<t.indexOf('Tag (optional)')&&t.indexOf('Tag (optional)')<t.indexOf('Activity types')&&!t.includes('Usage summary')&&!t.includes('In use since');})()");

 await click('Electric bike');
 await wait("document.querySelectorAll('select').length===0&&[...document.querySelectorAll('button')].find(e=>e.textContent==='Electric bike').getAttribute('aria-pressed')==='true'");
 await click('Save changes');
 await wait("window.formQA.writes.some(w=>w.table==='equipment'&&w.payload.category==='bike'&&w.payload.electric_assist==='electric')");
 await choose('equipment-page');await click('Edit Walking shoes');await click('Shoes');
 await wait("[...document.querySelectorAll('button')].find(e=>e.textContent==='Shoes').getAttribute('aria-pressed')==='true'");
 await click('Save changes');
 await wait("window.formQA.writes.some(w=>w.table==='equipment'&&w.payload.category==='shoes'&&w.payload.electric_assist===null)");
 await choose('ride-log');await wait("!document.body.innerText.includes('Bike type for this activity')");await layout();await shot('ride-log-mobile');
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await choose('journey-create');await layout();await shot('journey-create-desktop');
 if(await evaluate('window.formQA.network.length'))throw Error('Unexpected Supabase network request');
 if(errors.length)throw Error(JSON.stringify(errors));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{ws?.close();browser.kill();fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});console.log(`Virtual distance browser assertions: ${checks}; screenshots: ${out}`);});
