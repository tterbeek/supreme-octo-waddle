/* Run Vite first, then CHROME_BIN=/path/to/chrome node scripts/form-browser-check.cjs.
   No real services: fixtures block Supabase network and replace reads/writes. */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const WebSocket = require('ws');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'movenotes-forms-'));
const chrome = process.env.CHROME_BIN || '/home/thijs/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const output = process.env.FORM_QA_OUTPUT || '/tmp/movenotes-form-previews';
fs.mkdirSync(output, { recursive: true });
const browser = spawn(chrome, ['--no-sandbox','--disable-gpu','--headless','--ignore-certificate-errors','--remote-debugging-port=9228',`--user-data-dir=${profile}`,'about:blank'], {stdio:'ignore'});
const delay = ms => new Promise(resolve => setTimeout(resolve,ms));
let ws;
const results = [];
const exceptions = [];
(async()=>{
  let targets;
  for(let i=0;i<50;i++){try{targets=await(await fetch('http://127.0.0.1:9228/json/list')).json();if(targets.length)break}catch{}await delay(100)}
  if(!targets?.length)throw Error('Chromium did not start; set CHROME_BIN.');
  ws=new WebSocket(targets[0].webSocketDebuggerUrl);await new Promise(r=>ws.once('open',r));
  let id=0;const pending=new Map();let fileChooserNode=null;
  ws.on('message',raw=>{const m=JSON.parse(String(raw));if(m.id){const task=pending.get(m.id);pending.delete(m.id);m.error?task.reject(Error(m.error.message)):task.resolve(m.result)}if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails);if(m.method==='Page.fileChooserOpened')fileChooserNode=m.params.backendNodeId;});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const i=++id;pending.set(i,{resolve,reject});ws.send(JSON.stringify({id:i,method,params}))});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
  const waitFor=async(expression,limit=100)=>{for(let n=0;n<limit;n++){if(await evaluate(expression))return;await delay(40)}throw Error(`Timed out in ${await evaluate('window.formQA?.case')}: ${expression}\n${await evaluate('document.body.innerText')}`)};
  const click=async label=>{await evaluate(`(()=>{const nodes=[...document.querySelectorAll('button,a')].filter(b=>!b.closest('[inert]')&&getComputedStyle(b).visibility!=='hidden');const b=nodes.find(b=>b.textContent.trim()===${JSON.stringify(label)}||b.getAttribute('aria-label')===${JSON.stringify(label)});if(!b)throw Error('Missing button '+${JSON.stringify(label)});if(b.disabled)throw Error('Disabled button '+${JSON.stringify(label)});b.focus({preventScroll:true});b.click()})()`);await delay(50)};
  const type=async(selector,text)=>{await evaluate(`(()=>{const el=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>!e.closest('[inert]')&&getComputedStyle(e).visibility!=='hidden');if(!el)throw Error('Missing field');const p=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(el,${JSON.stringify(text)});el.dispatchEvent(new Event('input',{bubbles:true}))})()`);await delay(50)};
  const choose=async name=>{await evaluate(`window.formQA.select(${JSON.stringify(name)})`);await delay(200);await waitFor("!document.querySelector('[role=dialog] fieldset:disabled')");};
  const escape=async()=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});await delay(50)};
  const snapshot=async name=>{const data=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(data.data,'base64'))};
  const layout=async name=>{
    const report=await evaluate(`(()=>{const overlay=[...document.querySelectorAll('.mn-overlay')].filter(x=>x.getAttribute('aria-hidden')==='false');const panel=overlay[0]?.querySelector('[role=dialog]');const page=document.querySelector('.mn-page-form');const scope=panel||page;return {visible:overlay.length,overflow:document.documentElement.scrollWidth>innerWidth,title:!!scope?.querySelector('h1,h2'),close:panel?!!panel.querySelector('[data-overlay-close]'):!!page?.querySelector('[aria-label^="Back"]'),bodies:panel?.querySelectorAll(':scope > .mn-form-body:not([hidden])').length,unlabelled:[...(scope?.querySelectorAll('input:not([type=file]),textarea,select')||[])].filter(e=>!e.closest('[inert]')&&!e.getAttribute('aria-label')&&!e.getAttribute('aria-labelledby')&&!e.labels?.length).map(e=>e.outerHTML.slice(0,100)),nested:[...(panel?.querySelectorAll('.mn-form-body div,.mn-form-body section,.mn-form-body ul')||[])].filter(e=>['auto','scroll'].includes(getComputedStyle(e).overflowY)&&e.scrollHeight>e.clientHeight+2).length}})()`);
    if(report.visible>1||report.overflow||!report.title||!report.close||report.bodies>1||report.nested||report.unlabelled.length)throw Error(`${name}: ${JSON.stringify(report)}`);
    if(report.visible && !(await evaluate("(()=>{const e=document.querySelector('.mn-overlay[aria-hidden=false] [data-overlay-close]');const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1&&getComputedStyle(e).visibility==='visible'})()")))throw Error(name+' Close button is outside the visible viewport');
    results.push(name);
  };
  const views=async name=>{
    await layout(name+' mobile');
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await delay(50);await layout(name+' desktop');
    await send('Emulation.setDeviceMetricsOverride',{width:320,height:720,deviceScaleFactor:1,mobile:true});await evaluate("document.documentElement.style.fontSize='32px'");await delay(60);await layout(name+' 200% narrow');
    await evaluate("document.documentElement.style.fontSize=''");await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  };
  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await send('Page.navigate',{url:(process.env.FORM_QA_URL||'http://127.0.0.1:5182')+'/scripts/form-qa/index.html'});
  await waitFor('!!window.formQA');
  const overlays=['log','import','edit','edit-reflection','note','journal','journal-edit','preset-add','preset-edit','equipment-add','equipment-select','direction-choice','direction-measures','direction-add','direction-edit','tweak','tweak-adjust','companion-settings','welcome','onboarding','add-choice','type-choice','drawer','export'];
  const pages=['preset-page','equipment-page','activity-preferences','circle-profile','circle-invite','connections','settings','login','signup','polar-callback','strava-callback'];
  for(const name of (process.env.FORM_QA_SKIP_MATRIX ? [] : [...overlays,...pages])){
    await choose(name);await layout(name+' mobile');
    if(['log','edit','note','equipment-select','signup','onboarding'].includes(name))await snapshot(name+'-mobile');
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await delay(50);await layout(name+' desktop');if(['edit','equipment-add','signup'].includes(name))await snapshot(name+'-desktop');
    await send('Emulation.setDeviceMetricsOverride',{width:320,height:720,deviceScaleFactor:1,mobile:true});await evaluate("document.documentElement.style.fontSize='32px'");await delay(80);await layout(name+' enlarged narrow');
    await evaluate("document.documentElement.style.fontSize=''");await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  }
  const editable=[['log','#activity-title','Save activity'],['import','#activity-title','Save details'],['edit','#edit-activity-title','Save Changes'],['edit-reflection','textarea','Save reflection'],['note','textarea','Save reflection'],['journal','textarea','Save'],['journal-edit','textarea','Save'],['preset-add','#preset-name','Save preset'],['preset-edit','#preset-name','Save changes'],['equipment-add','input','Add equipment'],['direction-add','input[aria-label=Target]','Set direction'],['direction-edit','input[aria-label=Name]','Save Changes'],['tweak','textarea','Save'],['tweak-adjust','textarea','Save']];
  for(const[name,selector,save]of editable){
    await choose(name);await escape();await waitFor("!document.querySelector('.mn-overlay[aria-hidden=false]')");
    await choose(name);await type(selector,name==='direction-add'?'25':'A changed draft');await escape();await waitFor("document.body.innerText.includes('Keep editing')");await click('Keep editing');await escape();await click('Discard changes');
    await choose(name);await type(selector,name==='direction-add'?'25':'A changed draft');await evaluate('window.formQA.delay=300;window.formQA.fail=true');await click(save);
    if(!(await evaluate("document.querySelector('.mn-overlay[aria-hidden=false] [data-overlay-close]')?.disabled")))throw Error(name+' did not protect an in-flight save');
    await escape();
    await waitFor("!!document.querySelector('[role=alert]')");await layout(name+' returned save error');
  }
  await choose('equipment-page');await click('Edit Walking shoes');await views('equipment edit');await snapshot('equipment-edit-mobile');
  await click('Stop using this equipment');await views('equipment retirement confirmation');await click('Close Stop using this equipment');
  await type('input','Changed shoes');await escape();await click('Keep editing');await evaluate('window.formQA.fail=true');await click('Save changes');await waitFor("!!document.querySelector('[role=alert]')");
  await choose('settings');await click('Units');await views('units selector');await escape();
  await choose('settings');await click('Delete account');await views('account deletion request');await escape();
  await choose('activity-preferences');await click('Walk metric preference');await views('metric selector');await escape();
  await choose('edit');await click('Activity details');await type('input[type=date]','2026-10-16');await layout('expanded activity details and date');await escape();await click('Discard changes');
  await choose('direction-add');await evaluate("(()=>{const s=document.querySelector('select');s.value='month';s.dispatchEvent(new Event('change',{bubbles:true}))})()");await layout('Direction period dropdown');await escape();await click('Discard changes');
  await choose('settings');await click('Units');await evaluate('window.formQA.fail=true');await click('Imperial (mi)');await waitFor("!!document.querySelector('[role=alert]')");await layout('units save error');
  await choose('circle-profile');await type('#circle-name','Changed profile');await evaluate('window.formQA.fail=true');await click('Save profile');await waitFor("!!document.querySelector('[role=alert]')");await layout('profile save error');
  await choose('circle-invite');await click('Accept invitation');await waitFor("location.pathname==='/settings/circle'");
  await choose('login');await type('input[type=email]','fictional@example.invalid');await click('Send Login Code');await views('login OTP');
  await choose('signup');await type('input[type=email]','fictional@example.invalid');await evaluate("document.querySelector('#privacy').click();document.querySelector('#terms').click()");await click('Send Signup Code');await views('signup OTP');
  // Keyboard focus trapping and position restoration with a genuinely scrolled page.
  await choose('equipment-add');await escape();await evaluate('window.scrollTo(0,450)');await click('Open form');
  await evaluate("document.querySelector('.mn-form-footer button').focus()");await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab'});
  if(!(await evaluate("document.activeElement.hasAttribute('data-overlay-close')")))throw Error('Tab escaped overlay');
  await escape();await waitFor("document.body.style.position!=='fixed'");
  if(!(await evaluate("scrollY===450 && document.activeElement.textContent==='Open form'")))throw Error('Scroll/focus was not restored: '+await evaluate('JSON.stringify({scrollY,focus:document.activeElement.outerHTML,height:document.body.scrollHeight})'));
  // Exercise the existing real file-input path with a fictional local PNG, no upload.
  await choose('note');await send('Page.setInterceptFileChooserDialog',{enabled:true});await click('Choose photos');
  for(let i=0;i<40&&!fileChooserNode;i++)await delay(50);if(!fileChooserNode)throw Error('File chooser did not open');
  await send('DOM.setFileInputFiles',{backendNodeId:fileChooserNode,files:[path.resolve('docs/previews/activity-share-photo.png')]});await waitFor("document.body.innerText.includes('1/5 selected')");await layout('photo selected');await escape();await click('Keep editing');await escape();await click('Discard changes');
  // Explicit value changes and reversals; all dismissal routes use the same gate.
  await choose('equipment-add');await click('Add equipment');await waitFor("document.body.innerText.includes('Name is required')");await layout('equipment validation');
  await type('input','New shoes');await click('Close Add equipment');await waitFor("document.body.innerText.includes('Keep editing')");await snapshot('discard-mobile');
  await click('Keep editing');if(await evaluate("document.querySelector('input').value!=='New shoes'"))throw Error('Keep editing lost data');
  await escape();await click('Keep editing');
  await evaluate("(()=>{const b=document.querySelector('.mn-overlay[aria-hidden=false]');b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));b.click()})()");await waitFor("document.body.innerText.includes('Discard changes')");await click('Keep editing');
  await type('input','');await escape();await waitFor("!document.querySelector('[role=dialog]')");
  await choose('equipment-add');await type('input','New shoes');await escape();await click('Discard changes');await waitFor("!document.querySelector('[role=dialog]')");
  // Busy forms retain edits on server failure and cannot be dismissed mid-write.
  await choose('equipment-add');await type('input','New shoes');await evaluate('window.formQA.delay=500;window.formQA.fail=true');await click('Add equipment');
  if(!(await evaluate("document.querySelector('[data-overlay-close]').disabled")))throw Error('Saving form can close');await escape();await waitFor("document.body.innerText.includes('Simulated save error')");await layout('equipment saving error');
  // Nested selectors keep the parent mounted without multiple backdrops or locks.
  await choose('log');await type('#activity-title','Remember this draft');await click('+ Add equipment');await layout('nested equipment');await click('+ Add new equipment');await type('input','New gear');await layout('nested equipment create');await snapshot('nested-equipment-mobile');
  await escape();await click('Discard changes');await click('Close Equipment');
  if(!(await evaluate("document.querySelector('#activity-title').value==='Remember this draft' && document.body.style.position==='fixed'")))throw Error('Nested handoff lost draft or lock');
  await click('Close Log Walk');await click('Discard changes');await waitFor("document.body.style.position!=='fixed'");
  // The optional reflection closes without deleting the previously saved activity.
  await choose('note');const before=await evaluate('window.formQA.writes.length');await type('textarea','A private memory');await escape();await click('Discard changes');if(await evaluate(`window.formQA.writes.slice(${before}).some(x=>x.table==='activities'&&x.op==='delete')`))throw Error('Reflection dismissal deleted an activity');
  // Saved settings are not unsaved drafts.
  await choose('companion-settings');await evaluate("document.querySelector('input[type=checkbox]').click()");await delay(150);await escape();if(await evaluate("document.body.innerText.includes('Discard changes')"))throw Error('Instant-save settings prompted discard');
  await choose('companion-response');await click('Add your reflection');await type('textarea','My own words');await views('companion response');await escape();await click('Discard changes');
  await choose('tweak-review');await click('Add reflection');await type('textarea','A small change');await views('tweak review');await escape();await click('Discard changes');
  await choose('log');await click('More…');await views('all presets');await escape();
  await choose('onboarding');await click('Next');await views('onboarding equipment');await click('Next');await views('onboarding tiny tweak');await click('Next');await views('onboarding Direction');await click('Next');await views('onboarding finish');await escape();
  // Page Back and real history navigation are guarded by the data router.
  await choose('preset-page');await type('input[aria-label=Name]','Page draft');await click('Back from Add preset');await waitFor("document.body.innerText.includes('Keep editing')");await click('Keep editing');
  await choose('preset-page');await evaluate('window.formQA.checkpoint()');await delay(100);await type('input[aria-label=Name]','History draft');
  await evaluate('history.back()');await waitFor("document.body.innerText.includes('Keep editing')");await click('Keep editing');
  await evaluate("window.formQA.navigate('/presets')");await waitFor("document.body.innerText.includes('Discard changes')");await click('Keep editing');
  // Long text and viewport contraction emulate available keyboard space, not a native keyboard.
  await choose('journal');await type('textarea','A long reflection. '.repeat(300));await layout('long reflection');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:430,deviceScaleFactor:1,mobile:true});await delay(100);await layout('contracted keyboard viewport');await snapshot('keyboard-viewport');
  if(!(await evaluate("(()=>{const r=document.querySelector('.mn-form-footer').getBoundingClientRect();return r.bottom<=innerHeight+1&&r.top>=0})()")))throw Error('Footer unreachable with keyboard viewport');
  if(await evaluate('window.formQA.network.length'))throw Error('Blocked unmocked request: '+await evaluate('JSON.stringify(window.formQA.network.map(url=>url.split("?")[0]))'));
  if(exceptions.length)throw Error(JSON.stringify(exceptions));
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({browser:await send('Browser.getVersion'),checks:results,nativeKeyboard:false,productionRequests:0},null,2));
  console.log(`Passed ${results.length} form/layout scenarios. Screenshots: ${output}`);
})().catch(error=>{console.error(error.stack||error);if(exceptions.length)console.error(JSON.stringify(exceptions));process.exitCode=1}).finally(async()=>{ws?.close();browser.kill('SIGTERM');await delay(150);fs.rmSync(profile,{recursive:true,force:true})});
