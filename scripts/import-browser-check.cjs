// Fictional Mapbox routes only. Run Vite on 5182 with VITE_MAPBOX_ACCESS_TOKEN=pk.fixture.
// Fictional fixtures only; VITE_SOCIAL_V2_ENABLED=true Vite on port 5182.
const {spawn}=require('node:child_process');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const WebSocket=require('ws');
const out='/tmp/movenotes-import-previews';fs.mkdirSync(out,{recursive:true});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'movenotes-import-browser-'));
const browser=spawn(process.env.CHROME_BIN||'/home/thijs/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',['--no-sandbox','--disable-gpu','--headless','--remote-debugging-port=9247',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let ws;let checks=0;
(async()=>{
 let targets;for(let i=0;i<60;i++){try{targets=await(await fetch('http://127.0.0.1:9247/json/list')).json();if(targets.length)break;}catch{}await delay(100);}
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
 const mapRequests=[];let holdMaps=true,failMaps=false;const held=[];
 const image=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#f7fafc"/><path d="M100 260 260 80 440 240" fill="none" stroke="#e48a6c" stroke-width="5"/><text x="20" y="340">Fictional route map</text></svg>').toString('base64');
 const respond=async requestId=>send('Fetch.fulfillRequest',{requestId,responseCode:failMaps?503:200,responseHeaders:[{name:'Content-Type',value:failMaps?'text/plain':'image/svg+xml'}],body:failMaps?Buffer.from('Unavailable').toString('base64'):image});
 ws.on('message',raw=>{const m=JSON.parse(String(raw));if(m.method==='Fetch.requestPaused'){mapRequests.push(m.params.request.url);if(holdMaps)held.push(m.params.requestId);else void respond(m.params.requestId);}});
 await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Fetch.enable',{patterns:[{urlPattern:'https://api.mapbox.com/*'}]});
 await send('Page.navigate',{url:'http://127.0.0.1:5182/scripts/form-qa/index.html'});await wait('!!window.formQA');
 const action=async name=>{await evaluate(`window.formQA.importAction(${JSON.stringify(name)})`);await delay(150);};
 const locked=async()=>{await wait(`!document.querySelector('button[aria-label="Activity actions"]')&&!document.body.innerText.includes('Morning run Brussels')`);};
 await choose('import-polar');await action('discover');await wait("document.body.innerText.includes('New activity being imported')");await locked();
 await wait("document.querySelector('[aria-label=\"Activity being imported\"]').getBoundingClientRect().top<document.querySelector('h2').getBoundingClientRect().top");
 await evaluate(`document.querySelector('[aria-label="Activity being imported"]').click()`);await wait('!window.formQA.edited');await layout();await shot('import-processing-mobile');
 await action('ready');await wait("document.body.innerText.includes('Loading your map')");await locked();
 if(!held.length)throw Error('Preview was not requested before unlock');
 holdMaps=false;for(const id of held.splice(0))await respond(id);
 await wait("!document.body.innerText.includes('New activity being imported')&&document.body.innerText.includes('Morning run Brussels')");
 await wait("!!document.querySelector('img[alt=\"Map of your activity route\"]')?.naturalWidth");await layout();
 await shot('import-ready-mobile');await evaluate(`document.querySelector('.bg-warm-100').click()`);await wait('window.formQA.edited===1');
 // A second provider uses the same journey; no GPS must complete without a map request.
 await evaluate('window.formQA.importRows=[]');await choose('import-strava');await action('discover');await locked();
 await wait("document.body.innerText.includes('Strava')");const before=mapRequests.length;await action('no-gps');
 await wait("document.body.innerText.includes('Morning run Brussels')&&!document.body.innerText.includes('New activity being imported')");
 if(mapRequests.length!==before)throw Error('No-GPS import requested a map');
 // Interrupted preparation, request failure, retry on the same activity ID.
 await action('discover');await action('failed');await wait("document.body.innerText.includes('Import waiting to finish')");await locked();
 await evaluate('window.formQA.fail=true');await click('Retry import');await wait("document.body.innerText.includes('Could not retry')");
 await evaluate('window.formQA.fail=false');await click('Retry import');await wait("document.body.innerText.includes('New activity being imported')");
 await wait("window.formQA.invocations.some(i=>i.name==='strava-import-activities'&&i.options.body.retryActivityId==='fa000000-0000-4000-8000-000000000010')");
 await action('no-gps');await wait("document.body.innerText.includes('Morning run Brussels')");
 // Stalled worker can be retried without deleting logged data.
 await action('discover');await action('stalled');await wait("document.body.innerText.includes('Retry import')");await click('Retry import');await action('no-gps');
 // Map errors keep the template locked; retry waits for a successful preview.
 await evaluate('window.formQA.importRows=[]');await choose('import-polar');await evaluate('window.formQA.routeVariant=0.005');failMaps=true;await action('discover');await action('ready');await wait("document.body.innerText.includes('The map could not load')");await locked();
 failMaps=false;await click('Retry import');await wait("document.body.innerText.includes('Morning run Brussels')&&!document.body.innerText.includes('Import waiting to finish')");
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await action('discover');await layout();await shot('import-processing-desktop');
 await send('Emulation.setDeviceMetricsOverride',{width:320,height:720,deviceScaleFactor:1,mobile:true});await evaluate("document.documentElement.style.fontSize='24px'");await action('failed');await layout();await shot('import-retry-enlarged-text');
 if(await evaluate('window.formQA.network.length'))throw Error('Unexpected Supabase network request');
 if(errors.length)throw Error(JSON.stringify(errors));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{ws?.close();browser.kill();fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});console.log(`Import browser assertions: ${checks}; screenshots: ${out}`);});
