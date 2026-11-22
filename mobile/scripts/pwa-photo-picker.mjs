import fs from "node:fs";
import assert from "node:assert/strict";
import { attach, delay, adb } from "./webview-driver.mjs";
adb("shell", "input", "keyevent", "4");
await delay(400);
const c = await attach();
const click = async (label) => {
  const ok = await c.evaluate(
    `(()=>{const all=[...document.querySelectorAll('[aria-modal="true"]')];const scope=all.at(-1)||document;const b=[...scope.querySelectorAll('button,a')].find(b=>b.textContent.trim()===${JSON.stringify(label)}||b.getAttribute('aria-label')===${JSON.stringify(label)});if(!b)return false;b.click();return true})()`,
  );
  if (!ok) throw Error("Control missing: " + label);
  await delay(350);
};
if (
  await c.evaluate(
    "!!document.querySelector('[aria-label=\"Close Share as image\"]')",
  )
)
  await click("Close Share as image");
await click("Add");
await click("Walk");
await c.evaluate(
  `(()=>{for(const [selector,value] of [['#activity-title','Capacitor picker check'],['input[placeholder="Duration in min"]','10']]){const e=document.querySelector(selector);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));}})()`,
);
await delay(250);
await click("Save activity");
for(let i=0;i<50;i++){if(await c.evaluate(`!![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Choose photos')`))break;await delay(200);}
await click("Choose photos");
await delay(500);
fs.writeFileSync(
  new URL("../verification/android-photo-picker.png", import.meta.url),
  adb("exec-out", "screencap", "-p"),
);
adb("shell", "input", "keyevent", "4");
await delay(350);
assert.ok(
  (await c.evaluate("document.body.innerText")).includes("Add a reflection"),
);
await click("Done without a reflection");
assert.ok(
  (await c.evaluate("document.body.innerText")).includes(
    "Capacitor picker check",
  ),
);
fs.writeFileSync(
  new URL("../verification/pwa-picker-results.json", import.meta.url),
  JSON.stringify(
    {
      backend: "local Supabase",
      checks: [
        "Existing PWA Choose photos opens Android chooser",
        "Picker cancellation returns to unchanged optional reflection",
        "Skipping reflection preserves activity after picker cancellation",
      ],
    },
    null,
    2,
  ) + "\n",
);
c.close();
console.log("PWA native picker cancellation passed");
