// Fictional Trends fixtures; Vite on 5182. No production requests.
// Fictional fixtures only; VITE_SOCIAL_V2_ENABLED=true Vite on port 5182.
const {spawn}=require('node:child_process');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const WebSocket=require('ws');
const out='/tmp/movenotes-circle-fab-previews';fs.mkdirSync(out,{recursive:true});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'movenotes-circle-fab-browser-'));
const browser=spawn(process.env.CHROME_BIN||'/home/thijs/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',['--no-sandbox','--disable-gpu','--headless','--remote-debugging-port=9251',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let ws;let checks=0;
(async()=>{
 let targets;for(let i=0;i<60;i++){try{targets=await(await fetch('http://127.0.0.1:9251/json/list')).json();if(targets.length)break;}catch{}await delay(100);}
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
 await choose('social-page');await evaluate("window.formQA.navigate('/circle')");await wait("!!document.querySelector('button[aria-label=\"Add\"]')");
 await wait("(()=>{const r=document.querySelector('button[aria-label=\"Add\"]').getBoundingClientRect();return Math.abs(r.right-(innerWidth-16))<2&&Math.abs(r.bottom-(innerHeight-90))<2})()");await layout();await shot('circle-fab-mobile');
 await click('Add');await wait("document.querySelectorAll('[aria-modal=true]').length===1&&document.body.innerText.includes('Add connection')&&document.body.innerText.includes('Create Community')");await layout();await shot('circle-add-choices');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape'});await wait("!document.querySelector('[aria-modal=true]')&&document.activeElement?.getAttribute('aria-label')==='Add'");
 await click('Add');await click('Create Community');await wait("document.querySelectorAll('[aria-modal=true]').length===1&&document.querySelector('[aria-modal=true] h2').textContent==='Create Community'");await layout();await shot('create-community-from-fab');await click('Close Create Community');await wait("!document.querySelector('[aria-modal=true]')");
 await click('Brussels Runners');await wait("location.search.includes('audience=audience-community')");await click('Add');await click('Add connection');
 await wait("location.pathname==='/settings/circle'&&document.body.innerText.includes('Invite by link')&&document.body.innerText.includes('Share invite')&&!document.querySelector('[aria-modal=true]')");
 await click('Back from Manage social circle');await wait("location.pathname==='/circle'&&location.search.includes('audience=audience-community')&&!!document.querySelector('button[aria-label=\"Add\"]')");
 await click('Circle and Communities actions');await click('Configure');await wait("document.body.innerText.includes('Configure Circle & Communities')&&!document.querySelector('button[aria-label=\"Add\"]')");
 await evaluate("window.formQA.navigate('/circle')");await wait("!!document.querySelector('button[aria-label=\"Add\"]')");
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await layout();await shot('circle-fab-desktop');
 await send('Emulation.setDeviceMetricsOverride',{width:320,height:720,deviceScaleFactor:1,mobile:true});await evaluate("document.documentElement.style.fontSize='24px'");await click('Add');await layout();await shot('circle-fab-enlarged-text');await click('Close Add to Circle & Communities');
 if(await evaluate('window.formQA.writes.length'))throw Error('Opening creation options caused unexpected writes');
 if(await evaluate('window.formQA.network.length'))throw Error('Unexpected Supabase network request');
 if(errors.length)throw Error(JSON.stringify(errors));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{ws?.close();browser.kill();fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});console.log(`Circle FAB browser assertions: ${checks}; screenshots: ${out}`);});
