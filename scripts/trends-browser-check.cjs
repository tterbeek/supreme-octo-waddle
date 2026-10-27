// Fictional Trends fixtures; Vite on 5182. No production requests.
// Fictional fixtures only; VITE_SOCIAL_V2_ENABLED=true Vite on port 5182.
const {spawn}=require('node:child_process');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const WebSocket=require('ws');
const out='/tmp/movenotes-trends-previews';fs.mkdirSync(out,{recursive:true});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'movenotes-trends-browser-'));
const browser=spawn(process.env.CHROME_BIN||'/home/thijs/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',['--no-sandbox','--disable-gpu','--headless','--remote-debugging-port=9244',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let ws;let checks=0;
(async()=>{
 let targets;for(let i=0;i<60;i++){try{targets=await(await fetch('http://127.0.0.1:9244/json/list')).json();if(targets.length)break;}catch{}await delay(100);}
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

 await choose('trends');await wait("document.querySelector('select[aria-label=\"Trend period\"]').value==='week'&&document.body.innerText.includes('Run — Distance (km)')");await wait("document.querySelectorAll('.recharts-line').length>0");await layout();await shot('week-mobile');
 await fill('select[aria-label="Trend period"]','month');await wait("document.body.innerText.includes('Jan 26')&&document.body.innerText.includes('Mar 26')&&!document.body.innerText.includes('Feb 26')");await layout();await shot('month-mobile');
 const beforeToggle=await evaluate("window.formQA.invocations.filter(i=>i.name==='stats_activity_trends').length");await click('Duration');await wait("document.body.innerText.includes('Duration (min)')");if(await evaluate("window.formQA.invocations.filter(i=>i.name==='stats_activity_trends').length")!==beforeToggle)throw Error('Metric toggle fetched data again');
 await fill('select[aria-label="Trend period"]','year');await wait("document.body.innerText.includes('2020')&&document.body.innerText.includes('2023')&&document.body.innerText.includes('2026')");await click('Distance');await click('Switch units');await wait("document.body.innerText.includes('Distance (mi)')");await layout();await shot('year-mobile');
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await layout();await shot('year-desktop');
 await evaluate('window.formQA.delay=350');await fill('select[aria-label="Trend period"]','month');await fill('select[aria-label="Trend period"]','week');await wait("document.body.innerText.includes('11 Oct')&&!document.body.innerText.includes('Jan 26')&&!document.body.innerText.includes('Loading trends')");
 await evaluate('window.formQA.delay=0;window.formQA.fail=true');await fill('select[aria-label="Trend period"]','month');await wait("document.body.innerText.includes('Simulated trends error')");await evaluate('window.formQA.fail=false');await fill('select[aria-label="Trend period"]','year');await wait("document.body.innerText.includes('2020')&&!document.body.innerText.includes('Simulated trends error')");
 await evaluate('window.formQA.trendEmpty=true');await fill('select[aria-label="Trend period"]','month');await wait("document.body.innerText.includes('Not enough activity yet')&&!document.querySelector('.recharts-line')");
 await send('Emulation.setDeviceMetricsOverride',{width:320,height:720,deviceScaleFactor:1,mobile:true});await evaluate("document.documentElement.style.fontSize='24px'");await layout();await shot('empty-enlarged');
 if(await evaluate('window.formQA.network.length'))throw Error('Unexpected Supabase network request');
 if(errors.length)throw Error(JSON.stringify(errors));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{ws?.close();browser.kill();fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});console.log(`Trends browser assertions: ${checks}; screenshots: ${out}`);});
