import { attach, delay } from "./webview-driver.mjs";
const c = await attach();
console.log(
  await c.evaluate(
    `JSON.stringify({dialogs:[...document.querySelectorAll('[role="dialog"]')].map(e=>e.innerText),buttons:[...document.querySelectorAll('button')].map(b=>({text:b.textContent.trim(),label:b.getAttribute('aria-label')})),inputs:[...document.querySelectorAll('input')].map(e=>({label:e.getAttribute('aria-label'),type:e.type,id:e.id}))})`,
  ),
);
c.close();
