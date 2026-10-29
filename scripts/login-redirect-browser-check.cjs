// Fictional Trends fixtures; Vite on 5182. No production requests.
// Fictional fixtures only; VITE_SOCIAL_V2_ENABLED=true Vite on port 5182.
const {spawn}=require('node:child_process');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const WebSocket=require('ws');
const out='/tmp/movenotes-login-redirect-previews';fs.mkdirSync(out,{recursive:true});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'movenotes-login-redirect-browser-'));
const browser=spawn(process.env.CHROME_BIN||'/home/thijs/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',['--no-sandbox','--disable-gpu','--headless','--remote-debugging-port=9252',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let ws;let checks=0;
(async()=>{
 let targets;for(let i=0;i<60;i++){try{targets=await(await fetch('http://127.0.0.1:9252/json/list')).json();if(targets.length)break;}catch{}await delay(100);}
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
 const email='new-mover@example.invalid';
 await choose('login');await fill('#login-email',email);await evaluate("window.formQA.authError='Signups not allowed for this instance'");await click('Send Login Code');
 await wait(`location.pathname==='/signup'&&document.querySelector('input[type=email]')?.value===${JSON.stringify(email)}&&!document.body.innerText.includes('Discard changes')`);
 await wait("window.formQA.authRequests[0].options.shouldCreateUser===false");await layout();await shot('signup-prefilled-mobile');
 // Preserve a pending Community invite through the same transition.
 await choose('login');await evaluate("window.formQA.navigate('/login?next='+encodeURIComponent('/community/join/fictional-token'))");await fill('#login-email',email);await click('Send Login Code');
 await wait(`location.pathname==='/signup'&&new URLSearchParams(location.search).get('next')==='/community/join/fictional-token'&&document.querySelector('input[type=email]')?.value===${JSON.stringify(email)}&&!document.querySelector('[aria-modal=true]')`);
 // Other failures stay on login; ordinary unsaved navigation still asks.
 await choose('login');await fill('#login-email',email);await evaluate("window.formQA.authError='Simulated temporary auth failure'");await click('Send Login Code');
 await wait("document.body.innerText.includes('Simulated temporary auth failure')&&!!document.querySelector('#login-email')&&!document.querySelector('[aria-modal=true]')");
 await click('Back from Log in');await wait("!!document.querySelector('[aria-modal=true]')&&document.body.innerText.includes('Keep editing')");await click('Keep editing');await wait(`document.querySelector('#login-email')?.value===${JSON.stringify(email)}`);
 await fill('#login-email','invalid-email');await click('Send Login Code');await wait("document.body.innerText.includes('Please enter a valid email address')");
 if(await evaluate('window.formQA.network.length'))throw Error('Unexpected Supabase network request');
 if(errors.length)throw Error(JSON.stringify(errors));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{ws?.close();browser.kill();fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});console.log(`Login redirect browser assertions: ${checks}; screenshots: ${out}`);});
