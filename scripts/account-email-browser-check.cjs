// Fictional email/account-access fixtures; Vite on 5182. No production requests.
// Fictional fixtures only; VITE_SOCIAL_V2_ENABLED=true Vite on port 5182.
const {spawn}=require('node:child_process');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const WebSocket=require('ws');
const out='/tmp/movenotes-account-email-previews';fs.mkdirSync(out,{recursive:true});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'movenotes-account-email-browser-'));
const browser=spawn(process.env.CHROME_BIN||'/home/thijs/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',['--no-sandbox','--disable-gpu','--headless','--remote-debugging-port=9253',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let ws;let checks=0;
(async()=>{
 let targets;for(let i=0;i<60;i++){try{targets=await(await fetch('http://127.0.0.1:9253/json/list')).json();if(targets.length)break;}catch{}await delay(100);}
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
 await evaluate('window.formQA.resetAccountEmail()');await choose('profile-email');
 const section='section[aria-label="Login email"]';
 await wait(`document.querySelector(${JSON.stringify(section)})?.textContent.includes('original@example.invalid')`);
 await fill('#circle-name','An unsaved friendly name');await click('Change email');await wait("document.querySelector('[aria-modal=true] h2')?.textContent==='Change login email'");
 await fill('#new-account-email','invalid');await click('Send confirmation');await wait("document.body.innerText.includes('Please enter a valid email address')&&window.formQA.emailRequests.length===0");
 await fill('#new-account-email','original@example.invalid');await click('Send confirmation');await wait("document.body.innerText.includes('Enter a different email address')&&window.formQA.emailRequests.length===0");
 await fill('#new-account-email',' New.Email@example.invalid ');await evaluate('window.formQA.emailFail=true');await click('Send confirmation');await wait("document.body.innerText.includes('Email change could not be requested')&&!!document.querySelector('[aria-modal=true]')");
 await click('Close Change login email');await wait("document.body.innerText.includes('Discard changes')");await click('Keep editing');await wait("document.querySelector('#new-account-email').value.trim()==='New.Email@example.invalid'");
 await evaluate('window.formQA.emailFail=false;window.formQA.delay=350');await click('Send confirmation');await wait("document.querySelector('[aria-label=\"Close Change login email\"]').disabled");
 await wait("!document.querySelector('[aria-modal=true]')&&document.body.innerText.includes('Awaiting confirmation:')&&document.body.innerText.includes('new.email@example.invalid')");
 await wait("document.querySelector('#circle-name').value==='An unsaved friendly name'&&document.querySelector('[aria-label=\"Login email\"]').textContent.includes('original@example.invalid')");
 await wait("window.formQA.emailRequests.length===2&&window.formQA.emailRequests[1].options.emailRedirectTo==='http://127.0.0.1:5182/auth/email-change'");
 await wait("[...document.querySelectorAll('button')].find(b=>b.textContent==='Resend confirmation').disabled");
 await evaluate('window.formQA.delay=0');await click('Check confirmation');await wait("document.body.innerText.includes('Still awaiting email confirmation')");await layout();await shot('profile-email-pending-mobile');
 await evaluate('window.formQA.clock=Date.now()+61000;Date.now=()=>window.formQA.clock');await delay(1100);await click('Resend confirmation');
 await wait("window.formQA.emailResends.length===1&&window.formQA.emailResends[0].type==='email_change'&&window.formQA.emailResends[0].email==='new.email@example.invalid'");
 await evaluate('window.formQA.finishAccountEmail()');await wait("document.querySelector('[aria-label=\"Login email\"]').textContent.includes('new.email@example.invalid')&&!document.body.innerText.includes('Awaiting confirmation:')&&document.body.innerText.includes('Login email updated')");
 await wait("document.querySelector('#circle-name').value==='An unsaved friendly name'");
 await choose('profile-email');await wait("document.querySelector('[aria-label=\"Login email\"]').textContent.includes('new.email@example.invalid')&&!document.body.innerText.includes('Awaiting confirmation:')");
 // Independent pending status survives reopening Profile, and current Auth wins over stale preferences.
 await evaluate("window.formQA.emailUser={...window.formQA.emailUser,new_email:'later@example.invalid'}");await choose('profile-email');await wait("document.body.innerText.includes('Awaiting confirmation:')&&document.body.innerText.includes('later@example.invalid')");
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await layout();await shot('profile-email-desktop');
 await send('Emulation.setDeviceMetricsOverride',{width:320,height:720,deviceScaleFactor:1,mobile:true});await evaluate("document.documentElement.style.fontSize='24px'");await click('Change email');await layout();await shot('change-email-enlarged');await click('Close Change login email');
 // A partial confirmation may have no session. Do not claim success or show a blank protected route.
 await evaluate('window.formQA.emailSignedOut=true');await choose('email-change-callback');await wait("document.body.innerText.includes('Follow the confirmation instructions')&&[...document.querySelectorAll('a')].some(a=>a.textContent==='Sign in')");
 await evaluate("window.formQA.navigate('/auth/email-change?error=access_denied&error_code=otp_expired')");await wait("document.body.innerText.includes('This confirmation link has expired')");
 await evaluate('window.formQA.emailSignedOut=false');await choose('email-change-callback');await wait("document.body.innerText.includes('still awaiting confirmation')");
 await evaluate("window.formQA.emailUser={...window.formQA.emailUser,email:'later@example.invalid',new_email:''}");await choose('email-change-callback');await wait("document.body.innerText.includes('Your current login email is')&&document.body.innerText.includes('later@example.invalid')");await layout();await shot('email-confirmation-complete');
 // The real dev owner changes email and retains both UI gates; the old email cannot transfer access.
 await evaluate("window.formQA.resetAccountEmail();window.formQA.emailUser={...window.formQA.emailUser,id:'7725b4a2-16df-47dd-bae0-c7695717a342',email:'me@thijsterbeek.com'}");await choose('profile-email');
 await wait("document.querySelector('[aria-label=\"Login email\"]').textContent.includes('me@thijsterbeek.com')");
 await click('Change email');await fill('#new-account-email','renamed-owner@example.invalid');await click('Send confirmation');await wait("document.body.innerText.includes('Awaiting confirmation:')");
 await evaluate('window.formQA.finishAccountEmail();window.formQA.ownerUser={...window.formQA.emailUser}');await choose('owner-admin');await wait("document.body.innerText.includes('Admin reporting available')");
 await choose('owner-weekly');await wait("document.body.innerText.includes('Run weekly now')");
 await evaluate("window.formQA.ownerUser={...window.formQA.ownerUser,id:'589c83df-8ee7-4319-9203-5b5c9aae0d07'}");await choose('owner-admin');await wait("document.body.innerText.includes('Admin reporting available')");
 await evaluate("window.formQA.ownerUser={...window.formQA.ownerUser,id:'other-account',email:'me@thijsterbeek.com'}");await choose('owner-admin');await wait("location.pathname==='/'&&!document.body.innerText.includes('Admin reporting available')");
 await choose('owner-weekly');await wait("!document.body.innerText.includes('Run weekly now')");
 if(await evaluate('window.formQA.writes.length'))throw Error('Email UI wrote to app profiles before Auth confirmation');
 if(await evaluate('window.formQA.network.length'))throw Error('Unexpected Supabase network request');
 if(errors.length)throw Error(JSON.stringify(errors));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{ws?.close();browser.kill();fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});console.log(`Account-email browser assertions: ${checks}; screenshots: ${out}`);});
