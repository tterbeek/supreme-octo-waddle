import fs from "node:fs";
import { attach, delay, adb } from "./webview-driver.mjs";
const c = await attach();
const click = async (label) => {
  const ok = await c.evaluate(
    `(()=>{const all=[...document.querySelectorAll('[aria-modal="true"]')];const scope=all.at(-1)||document;const b=[...scope.querySelectorAll('button,a,[role="button"]')].find(b=>b.textContent.trim()===${JSON.stringify(label)}||b.getAttribute('aria-label')===${JSON.stringify(label)});if(!b)return false;b.click();return true;})()`,
  );
  if (!ok) throw Error("Button missing: " + label);
  await delay(350);
};
await click("Skip");
await click("Add");
console.log(await c.evaluate("document.body.innerText"));
c.close();
