import { attach } from "./webview-driver.mjs";
const c = await attach();
console.log(
  await c.evaluate(
    `(async()=>JSON.stringify({url:location.origin+location.pathname,title:document.title,text:document.body.innerText.slice(0,1800),viewport:[innerWidth,innerHeight],native:!!window.Capacitor,isSecureContext,sw:navigator.serviceWorker?await navigator.serviceWorker.getRegistrations().then(r=>r.length):null}))()`,
  ),
);
c.close();
