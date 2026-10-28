// Fictional sharing fixtures; Vite on 5182. No production requests.
// Fictional fixtures only; VITE_SOCIAL_V2_ENABLED=true Vite on port 5182.
const {spawn}=require('node:child_process');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const WebSocket=require('ws');
const out='/tmp/movenotes-map-share-previews';fs.mkdirSync(out,{recursive:true});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'movenotes-map-share-browser-'));
const browser=spawn(process.env.CHROME_BIN||'/home/thijs/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',['--no-sandbox','--disable-gpu','--headless','--remote-debugging-port=9249',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let ws;let checks=0;
(async()=>{
 let targets;for(let i=0;i<60;i++){try{targets=await(await fetch('http://127.0.0.1:9249/json/list')).json();if(targets.length)break;}catch{}await delay(100);}
 if(!targets?.length)throw Error('Chromium unavailable');
 ws=new WebSocket(targets[0].webSocketDebuggerUrl);await new Promise(r=>ws.once('open',r));
 let next=0;const pending=new Map();const errors=[];
 ws.on('message',raw=>{const m=JSON.parse(String(raw));if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async expression=>{for(let i=0;i<150;i++){if(await evaluate(expression)){checks++;return;}await delay(40);}throw Error(`Timeout: ${expression}\n${await evaluate('document.body.innerText')}\n${JSON.stringify(errors)}`);};
 const click=async text=>{await evaluate(`(()=>{const b=[...document.querySelectorAll('button,a')].find(b=>!b.closest('[inert]')&&(b.textContent.trim()===${JSON.stringify(text)}||b.getAttribute('aria-label')===${JSON.stringify(text)}||document.getElementById(b.getAttribute('aria-labelledby'))?.textContent.trim()===${JSON.stringify(text)}));if(!b||b.disabled)throw Error('Unavailable button: '+${JSON.stringify(text)}+' | '+document.body.innerText);b.focus();b.click();})()`);await delay(100);};
 const openThread=async()=>{if(await evaluate("[...document.querySelectorAll('button')].some(b=>!b.closest('[inert]')&&b.textContent.trim()==='Comments and reactions')"))await click('Comments and reactions');else await click('Open activity conversation');};
 const choose=async name=>{await evaluate(`window.formQA.select(${JSON.stringify(name)})`);await delay(180);};
 const fill=async(selector,value)=>{await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing input '+${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);await delay(80);};
 const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(r.data,'base64'));};
 const layout=async()=>{await wait('document.documentElement.scrollWidth<=window.innerWidth+1');await wait("[...document.querySelectorAll('[aria-modal=true]')].every(e=>e.getBoundingClientRect().bottom<=window.innerHeight+1)");};
 await send('Runtime.enable');await send('Page.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 const requests=[];let failMaps=false,holdFull=false;const held=[];
 const font=fs.readFileSync('/usr/share/fonts/gnu-free/FreeSans.ttf').toString('base64');
 const italic=fs.readFileSync('/usr/share/fonts/gnu-free/FreeSansOblique.ttf').toString('base64');
 const css=`@font-face{font-family:"Nunito Sans";font-weight:600 700;src:url(data:font/ttf;base64,${font})} @font-face{font-family:"Playfair Display";font-style:italic;font-weight:500;src:url(data:font/ttf;base64,${italic})}`;
 const respond=async(requestId,full=false)=>{
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="720"><rect width="1080" height="720" fill="#f7fafc"/><path d="M0 200Q400 100 1080 300M0 450Q500 150 1080 500" stroke="#cdddc8" stroke-width="65" fill="none"/><path d="${full?'M100 600L200 400L600 160L900 400L980 620':'M200 400L600 160L900 400'}" fill="none" stroke="#e48a6c" stroke-width="6"/><text x="40" y="60" fill="#374d44" font-size="26">Fictional map — ${full?'full route':'start and finish hidden'}</text><text x="12" y="702" font-size="20">mapbox</text><text x="730" y="702" font-size="18">© Mapbox © OpenStreetMap</text></svg>`;
  await send('Fetch.fulfillRequest',{requestId,responseCode:failMaps?503:200,responseHeaders:[{name:'Content-Type',value:failMaps?'text/plain':'image/svg+xml'},{name:'Access-Control-Allow-Origin',value:'*'}],body:Buffer.from(failMaps?'Unavailable':svg).toString('base64')}).catch(()=>{});
 };
 ws.on('message',raw=>{const m=JSON.parse(String(raw));if(m.method==='Fetch.requestPaused'){
  const url=m.params.request.url;
  if(url.includes('fonts.googleapis.com'))void send('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/css'}],body:Buffer.from(css).toString('base64')});
  else {requests.push(url);void evaluate('window.formQA.shareSourceRoute').then(route=>{const full=route&&url.includes(encodeURIComponent(route));if(holdFull&&full)held.push(m.params.requestId);else void respond(m.params.requestId,full);});}
 }});
 await send('Fetch.enable',{patterns:[{urlPattern:'https://api.mapbox.com/*'},{urlPattern:'https://fonts.googleapis.com/*'}]});
 await send('Page.navigate',{url:'http://127.0.0.1:5182/scripts/form-qa/index.html'});await wait('!!window.formQA');
 await evaluate("Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.formQA.shared=data.files[0]}})");
 const preview="document.querySelector('img[alt^=\"Prepared activity image\"]')";
 const ready=()=>wait(`${preview}?.naturalWidth===1080`);
 const hash=async expression=>evaluate(`(async()=>{const blob=${expression};return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].join(',')})()`);
 const savePreview=async name=>{const url=await evaluate(`(async()=>{const blob=await(await fetch(${preview}.src)).blob();return await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(blob)})})()`);fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(url.split(',')[1],'base64'));};
 await choose('share-map');await ready();if(requests.length)throw Error('Map requested before choosing Map');
 await click('Map');await ready();await wait("document.querySelector('[role=switch]').getAttribute('aria-checked')==='true'");
 const hiddenURL=requests.at(-1);const source=await evaluate('window.formQA.shareSourceRoute');if(hiddenURL.includes(encodeURIComponent(source)))throw Error('Hidden map sent the full route');
 await layout();await shot('map-sharing-mobile');await savePreview('map-sharing-export-hidden');
 const hiddenHash=await hash(`await(await fetch(${preview}.src)).blob()`);const mapHeight=await evaluate(`${preview}.naturalHeight`);
 await click('Share image');if(await hash('window.formQA.shared')!==hiddenHash)throw Error('Shared PNG differs from preview');
 await click('Hide start and finish');await ready();await wait("document.querySelector('[role=switch]').getAttribute('aria-checked')==='false'");
 if(!requests.at(-1).includes(encodeURIComponent(source)))throw Error('Explicit full route was not requested');
 const fullHash=await hash(`await(await fetch(${preview}.src)).blob()`);if(fullHash===hiddenHash)throw Error('Privacy switch did not change export');
 await savePreview('map-sharing-export-full');
 // A delayed full-route response must never replace the newly hidden preview.
 await click('Hide start and finish');await ready();holdFull=true;await click('Hide start and finish');
 await wait(`!${preview}&&[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Save image').every(b=>b.disabled)`);
 await click('Hide start and finish');await ready();for(const id of held.splice(0))await respond(id,true);holdFull=false;await delay(150);
 if(await hash(`await(await fetch(${preview}.src)).blob()`)!==hiddenHash)throw Error('Stale full-route image replaced hidden preview');
 // Existing photo exports retain portrait orientation; text-only exports still work.
 await click('Use photo 1');await ready();await wait(`${preview}.naturalHeight>${mapHeight}`);await savePreview('photo-export-portrait');
 await click('No image');await ready();await wait(`!document.querySelector('[role=switch]')`);
 await choose('share-map');await ready();await click('Map');await ready();await wait("document.querySelector('[role=switch]').getAttribute('aria-checked')==='true'");
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await layout();await shot('map-sharing-desktop');
 await choose('share-map-short');await ready();const beforeShort=requests.length;await click('Map');await wait("document.body.innerText.includes('Not enough route remains')");if(requests.length!==beforeShort)throw Error('Short hidden route reached Mapbox');
 await click('Hide start and finish');await ready();
 await choose('share-map-none');await ready();await wait("![...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Map')");
 await choose('share-map-legacy');await ready();await click('Map');await ready();await wait("window.formQA.invocations.some(i=>i.name==='polar-activity-route')");
 failMaps=true;await click('Hide start and finish');await wait("document.body.innerText.includes('The map could not load')");failMaps=false;await click('Retry');await ready();
 await send('Emulation.setDeviceMetricsOverride',{width:320,height:720,deviceScaleFactor:1,mobile:true});await evaluate("document.documentElement.style.fontSize='24px'");await layout();await shot('map-sharing-enlarged-text');
 if(await evaluate('window.formQA.writes.length'))throw Error('Sharing wrote to the database');
 if(await evaluate('window.formQA.network.length'))throw Error('Unexpected Supabase network request');
 if(errors.length)throw Error(JSON.stringify(errors));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{ws?.close();browser.kill();fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});console.log(`Map-sharing browser assertions: ${checks}; screenshots/exports: ${out}`);});
