// Fictional Mapbox routes only. Run Vite on 5182 with VITE_MAPBOX_ACCESS_TOKEN=pk.fixture.
// Fictional fixtures only; VITE_SOCIAL_V2_ENABLED=true Vite on port 5182.
const {spawn}=require('node:child_process');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const WebSocket=require('ws');
const base=process.env.CURATED_BASE_URL||'http://127.0.0.1:5182';
const out='/tmp/movenotes-curated-previews';fs.mkdirSync(out,{recursive:true});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'movenotes-map-browser-'));
const browser=spawn(process.env.CHROME_BIN||'/home/thijs/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--headless','--remote-debugging-port=9262',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let ws;let checks=0;
(async()=>{
 let targets;for(let i=0;i<60;i++){try{targets=await(await fetch('http://127.0.0.1:9262/json/list')).json();if(targets.length)break;}catch{}await delay(100);}
 if(!targets?.length)throw Error('Chromium unavailable');
 ws=new WebSocket(targets[0].webSocketDebuggerUrl);await new Promise(r=>ws.once('open',r));
 let next=0;const pending=new Map();const errors=[];const logs=[];
 ws.on('message',raw=>{const m=JSON.parse(String(raw));if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.method==='Runtime.consoleAPICalled')logs.push(m.params.args.map(a=>a.value??a.description).join(' '));});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async expression=>{for(let i=0;i<1000;i++){if(await evaluate(expression)){checks++;return;}await delay(40);}throw Error(`Timeout: ${expression}\n${await evaluate('document.body.innerText')}\n${JSON.stringify(errors)}\n${JSON.stringify(logs.slice(-12))}\n${await evaluate("document.querySelectorAll('canvas').length")}`);};
 const click=async text=>{await evaluate(`(()=>{const b=[...document.querySelectorAll('button,a,summary')].find(b=>!b.closest('[inert]')&&(b.textContent.trim()===${JSON.stringify(text)}||b.getAttribute('aria-label')===${JSON.stringify(text)}));if(!b||b.disabled)throw Error('Unavailable button: '+${JSON.stringify(text)}+' | '+document.body.innerText);b.focus();b.click();})()`);await delay(100);};
 const openThread=async()=>{if(await evaluate("[...document.querySelectorAll('button')].some(b=>!b.closest('[inert]')&&b.textContent.trim()==='Comments and reactions')"))await click('Comments and reactions');else await click('Open activity conversation');};
 const choose=async name=>{await evaluate(`window.formQA.select(${JSON.stringify(name)})`);await delay(180);};
 const fill=async(selector,value)=>{await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing input '+${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);await delay(80);};
 const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(r.data,'base64'));};
 const layout=async()=>{await wait('document.documentElement.scrollWidth<=window.innerWidth+1');await wait("[...document.querySelectorAll('[aria-modal=true]')].every(e=>e.getBoundingClientRect().bottom<=window.innerHeight+1)");};
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 const mapRequests=[];let failMaps=false;
 const fictionalStyle={version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#edf3f1'}}]};
 ws.on('message',raw=>{const m=JSON.parse(String(raw));if(m.method==='Fetch.requestPaused'){
  const url=m.params.request.url;mapRequests.push(url);const failed=failMaps&&url.includes('/styles/v1/');const image=url.includes('/static/');
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="660"><rect width="1440" height="660" fill="#E7F0F3"/><path d="M0 150Q400 0 700 320T1440 500V660H0Z" fill="#D8E5D4"/><path d="M260 100L580 310L900 510" fill="none" stroke="#E48A6C" stroke-width="8"/><text x="25" y="625" font-size="24">Fictional static map · Mapbox · © OpenStreetMap</text></svg>';
  void send('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:failed?401:200,responseHeaders:[{name:'Content-Type',value:image?'image/svg+xml':'application/json'},{name:'Cache-Control',value:image?'public,max-age=43200':'no-store'},{name:'Access-Control-Allow-Origin',value:'*'}],body:Buffer.from(image?svg:JSON.stringify(url.includes('/styles/v1/')?fictionalStyle:{})).toString('base64')});
 }});
 if(!process.env.CURATED_LIVE_MAPS)await send('Fetch.enable',{patterns:[{urlPattern:'https://api.mapbox.com/*'},{urlPattern:'https://events.mapbox.com/*'}]});
 await send('Page.navigate',{url:base+'/scripts/form-qa/index.html'});await wait('!!window.formQA');
 if(process.env.CURATED_NO_TOKEN){
  await evaluate("window.formQA.setCuratedDemo('weekend-in-paris',200)");await choose('curated-detail');
  await wait("document.body.innerText.includes('The map is unavailable')&&document.body.innerText.includes('Along the way')");
  await layout();await shot('missing-token-mobile');if(mapRequests.length)throw Error('Missing token still requested maps');return;
 }
 await choose('journey-create');await click('Choose a map route');
 await wait("document.querySelectorAll('button[aria-label^=\"Preview \"]').length===10");
 if(process.env.CURATED_LIVE_MAPS){
  const labels=await evaluate("[...document.querySelectorAll('button')].map(e=>e.getAttribute('aria-label')).filter(t=>t?.startsWith('Preview '))");
  for(const label of labels){
   await evaluate(`[...document.querySelectorAll('button')].find(e=>e.getAttribute('aria-label')===${JSON.stringify(label)}).scrollIntoView()`);
   await wait(`(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.getAttribute('aria-label')===${JSON.stringify(label)}),img=b?.querySelector('img');return img?.naturalWidth>0&&getComputedStyle(img).opacity==='1';})()`);
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
  await evaluate("[...document.querySelectorAll('button')].find(e=>e.getAttribute('aria-label')==='Preview A Weekend in Paris').scrollIntoView()");await shot('library-live-desktop');
  console.log('Live static Mapbox images loaded successfully: '+labels.length);return;
 }
 if(mapRequests.some(u=>!u.includes('/static/')))throw Error('Library mounted an interactive map');
 await wait("[...document.querySelectorAll('[data-journey-artwork] img')].some(e=>e.naturalWidth>0&&getComputedStyle(e).opacity==='1')");
 await layout();await shot('library-mobile');
 await click('Preview A Weekend in Paris');await wait("document.body.innerText.includes('Fixed target:')");
 await layout();await shot('route-review-mobile');await click('Use this route');
 await wait("document.body.innerText.includes('Route target')&&!document.querySelector('input[id$=target]')");
 await fill('input[id$=start]','2026-10-19');await click('Start challenge');
 await wait("window.formQA.writes.some(w=>w.table==='social_challenges'&&w.payload.p_data.journey_template_slug==='weekend-in-paris')");
 await evaluate("window.formQA.setCuratedDemo('weekend-in-paris',200)");await choose('curated-detail');
 await wait("document.querySelectorAll('.mapboxgl-canvas').length===1");
 await wait("[...document.querySelectorAll('button')].find(e=>e.textContent==='Our position')?.disabled===false");
 await wait("document.querySelector('.mapboxgl-canvas').getBoundingClientRect().height>=300&&document.querySelector('.mapboxgl-ctrl-logo').getBoundingClientRect().height>0");
 await wait("document.body.innerText.includes('Brussels')&&document.body.innerText.includes('people moving us forward')");
 await layout();await shot('paris-mobile');
 await evaluate('window.savedCanvas=document.querySelector(".mapboxgl-canvas")');const requestsBefore=mapRequests.filter(u=>u.includes('/styles/v1/')&&!u.includes('/static/')).length;
 await evaluate("window.formQA.setUnits('imperial')");await wait("document.body.innerText.includes('virtual miles')&&window.savedCanvas===document.querySelector('.mapboxgl-canvas')");await evaluate("window.formQA.setUnits('metric')");
 await evaluate('window.formQA.setCuratedTotal(450)');await wait("document.body.innerText.includes('You reached the final destination together')");
 await wait('window.savedCanvas===document.querySelector(".mapboxgl-canvas")');
 if(mapRequests.filter(u=>u.includes('/styles/v1/')&&!u.includes('/static/')).length!==requestsBefore)throw Error('Progress reloaded the map');
 await evaluate('window.formQA.setCuratedTotal(0)');await wait("document.querySelector('button[aria-label=\"Amsterdam · Reached\"]')&&document.querySelector('button[aria-label=\"Paris · Still ahead\"]')");
 await click('Paris · Still ahead');await wait("document.body.innerText.includes('not a record of a physical visit')");
 await click('Close Paris');await wait("document.querySelectorAll('[aria-modal=true]').length===1");
 for(const slug of ['across-the-alps','discover-japan','around-the-world']){
  await evaluate(`window.formQA.setCuratedDemo(${JSON.stringify(slug)},0)`);await choose('curated-detail');
  await wait("[...document.querySelectorAll('button')].find(e=>e.textContent==='Our position')?.disabled===false");
  await layout();await shot(slug+'-mobile');
 }
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
 await evaluate("window.formQA.setCuratedDemo('around-the-world',20000)");await choose('curated-detail');
 await wait("[...document.querySelectorAll('button')].find(e=>e.textContent==='Our position')?.disabled===false");await layout();await shot('world-desktop');
 await click('Our position');await click('Whole route');
 await evaluate("window.formQA.setCuratedDemo('discover-japan',100,'closed')");await choose('curated-detail');
 await wait("document.body.innerText.includes('this chapter ended before the final destination')");await shot('closed-before-finish-desktop');
 await choose('journey-create');await click('Choose a map route');await layout();await shot('library-desktop');
 // An image error leaves the local artwork usable without breaking selection.
 await choose('journey-create');await click('Choose a map route');
 await evaluate("document.querySelector('button[aria-label=\"Preview Around the World Together\"]').scrollIntoView();");
 await wait("!!document.querySelector('button[aria-label=\"Preview Around the World Together\"] img')");
 await evaluate("document.querySelector('button[aria-label=\"Preview Around the World Together\"] img').dispatchEvent(new Event('error'))");
 await wait("!!document.querySelector('button[aria-label=\"Preview Around the World Together\"] svg')&&!document.querySelector('button[aria-label=\"Preview Around the World Together\"] [data-journey-artwork]')");
 failMaps=false;
 // A failed map must leave the actual text journey usable.
 failMaps=true;await evaluate("window.formQA.setCuratedDemo('across-the-alps',200)");await choose('curated-detail');
 await wait("document.body.innerText.includes('map could not load')");
 await wait("document.body.innerText.includes('Along the way')&&document.body.innerText.includes('Salzburg')");await shot('map-failure-desktop');
 failMaps=false;await click('Retry map');await wait("[...document.querySelectorAll('button')].find(e=>e.textContent==='Our position')?.disabled===false");
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await send('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:true});
 await evaluate("document.documentElement.style.fontSize='22px'");await layout();await shot('landscape-large-text');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
 await wait("document.querySelector('[aria-modal=true]').contains(document.activeElement)");
 // A WebGL failure must not prevent reading the milestone list.
 await send('Page.addScriptToEvaluateOnNewDocument',{source:"const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:original.call(this,type,...args)};"});
 await send('Page.navigate',{url:base+'/scripts/form-qa/index.html'});await wait('!!window.formQA');
 await evaluate("window.formQA.setCuratedDemo('discover-japan',100)");await choose('curated-detail');
 await wait("document.body.innerText.includes('map could not start')&&document.body.innerText.includes('Along the way')");await shot('no-webgl-mobile');
 if(mapRequests.some(url=>/directions|geocoding/i.test(url)))throw Error('Unexpected routing/geocoding request');
 if(await evaluate('window.formQA.network.length'))throw Error('Unexpected Supabase network request');
 if(errors.length)throw Error(JSON.stringify(errors));
 console.log('Mapbox requests served from fictional local style: '+mapRequests.length);
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
 ws?.close();browser.kill();await new Promise(r=>{browser.once('exit',r);setTimeout(r,2000);});
 fs.rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200});
 console.log(`Curated journey browser assertions: ${checks}; screenshots: ${out}`);
});
