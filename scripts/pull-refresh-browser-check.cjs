// Fictional Mapbox routes only. Run Vite on 5182 with VITE_MAPBOX_ACCESS_TOKEN=pk.fixture.
// Fictional fixtures only; VITE_SOCIAL_V2_ENABLED=true Vite on port 5182.
const {spawn}=require('node:child_process');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const WebSocket=require('ws');
const out='/tmp/movenotes-pull-previews';fs.mkdirSync(out,{recursive:true});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'movenotes-pull-browser-'));
const browser=spawn(process.env.CHROME_BIN||'/home/thijs/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',['--no-sandbox','--disable-gpu','--headless','--remote-debugging-port=9248',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let ws;let checks=0;
(async()=>{
 let targets;for(let i=0;i<60;i++){try{targets=await(await fetch('http://127.0.0.1:9248/json/list')).json();if(targets.length)break;}catch{}await delay(100);}
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
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
 await send('Page.navigate',{url:'http://127.0.0.1:5182/scripts/form-qa/index.html'});await wait('!!window.formQA');await choose('pull-refresh');
 await evaluate('window.formQA.clock=Date.now();Date.now=()=>window.formQA.clock');
 const importCount=()=>evaluate("window.formQA.invocations.filter(i=>i.name==='polar-import-activities').length");
 const gesture=async({dy=170,dx=0,selector='[data-pull-target]',cancel=false,release=true}={})=>{
  const point=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.left+40,y:Math.max(110,r.top+30)}})()`);
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point.x,y:point.y}]});
  for(let i=1;i<=10;i++){await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x+dx*i/10,y:point.y+dy*i/10}]});await delay(15);}
  if(release)await send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});
 };
 await gesture({dy:55});await delay(150);await wait('!window.formQA.pullRefreshCalls');
 await gesture({dx:150,dy:40});await wait('!window.formQA.pullRefreshCalls');
 await gesture({cancel:true});await wait('!window.formQA.pullRefreshCalls');
 await gesture({release:false});await wait("document.body.innerText.includes('Release to refresh')");await shot('pull-release-mobile');
 await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await wait("document.body.innerText.includes('Journal refreshed')");await wait('window.formQA.pullRefreshCalls===1');
 if(await importCount()!==1)throw Error('First pull did not import exactly once');
 await gesture();await wait('window.formQA.pullRefreshCalls===2');if(await importCount()!==1)throw Error('One-minute cooldown not applied');
 await evaluate('window.formQA.clock+=61000;window.formQA.delay=600');
 await gesture();await wait("document.body.innerText.includes('Checking for activities')");await gesture();await wait('window.formQA.pullRefreshCalls===3');
 await wait("document.body.innerText.includes('Journal refreshed')");if(await importCount()!==2)throw Error('Concurrent pull started an extra import');
 await evaluate('window.formQA.delay=0');
 // Scrolling through old activities, nested controls and modal interactions do not refresh.
 await evaluate('window.scrollTo(0,250)');await gesture({selector:'[data-swipe-ignore]'});await delay(100);await wait('window.formQA.pullRefreshCalls===3');
 await evaluate('window.scrollTo(0,0)');await gesture({selector:'[data-swipe-ignore]'});await wait('window.formQA.pullRefreshCalls===3');
 await click('Open overlay');await gesture({selector:'[role=dialog] p'});await wait('window.formQA.pullRefreshCalls===3');await click('Close overlay');
 await evaluate('window.formQA.clock+=61000;window.formQA.fail=true');await gesture();await wait("document.body.innerText.includes('Simulated Polar failure')");await layout();await shot('pull-error-mobile');
 await evaluate('window.formQA.fail=false');await click('Refresh Journal');await wait("document.body.innerText.includes('Journal refreshed')");if(await importCount()!==3)throw Error('Failure bypassed cooldown');
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await click('Refresh Journal');await wait("document.body.innerText.includes('Journal refreshed')");await layout();await shot('pull-desktop');
 await send('Emulation.setDeviceMetricsOverride',{width:320,height:720,deviceScaleFactor:1,mobile:true});await evaluate("document.documentElement.style.fontSize='24px'");await layout();await shot('pull-enlarged-text');
 await choose('');await wait("document.documentElement.style.overscrollBehaviorY===''&&document.body.style.overscrollBehaviorY===''");
 if(await evaluate('window.formQA.network.length'))throw Error('Unexpected Supabase network request');
 if(errors.length)throw Error(JSON.stringify(errors));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{ws?.close();browser.kill();fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});console.log(`Pull-refresh browser assertions: ${checks}; screenshots: ${out}`);});
