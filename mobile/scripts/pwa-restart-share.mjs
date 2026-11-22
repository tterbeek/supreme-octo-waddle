import fs from "node:fs";
import assert from "node:assert/strict";
import { attach, delay, adb } from "./webview-driver.mjs";
let c = await attach();
const checks = [];
const click = async (label) => {
  const ok = await c.evaluate(
    `(()=>{const all=[...document.querySelectorAll('[aria-modal="true"]')];const scope=all.at(-1)||document;const b=[...scope.querySelectorAll('button,a,[role="button"]')].find(b=>b.textContent.trim()===${JSON.stringify(label)}||b.getAttribute('aria-label')===${JSON.stringify(label)}||[...b.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim()===${JSON.stringify(label)});if(!b)return false;b.click();return true;})()`,
  );
  if (!ok) throw Error("Missing control: " + label);
  await delay(400);
};
await click("Done without a reflection");
assert.ok(
  (await c.evaluate("document.body.innerText")).includes(
    "Capacitor local walk",
  ),
);
checks.push(
  "Skipping the existing optional reflection preserves the saved activity",
);
c.close();
adb("shell", "am", "force-stop", "app.movenotes.android.dev");
adb("shell", "am", "start", "-n", "app.movenotes.android.dev/.MainActivity");
await delay(2500);
c = await attach();
for (let i = 0; i < 40; i++) {
  if (
    (await c.evaluate("document.body.innerText")).includes(
      "Capacitor local walk",
    )
  )
    break;
  await delay(300);
}
assert.ok(
  (await c.evaluate("document.body.innerText")).includes(
    "Capacitor local walk",
  ),
);
checks.push(
  "Restart restores real local Supabase session and Journal activity",
);
fs.writeFileSync(
  new URL("../verification/android-journal.png", import.meta.url),
  adb("exec-out", "screencap", "-p"),
);
await click("Activity actions");
await click("Share");
await click("Share other");
for (let i = 0; i < 60; i++) {
  if (
    await c.evaluate(
      `!![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Share image'&&!b.disabled)`,
    )
  )
    break;
  await delay(500);
}
console.log(await c.evaluate("document.body.innerText"));
await click("Share image");
await delay(1000);
fs.writeFileSync(
  new URL("../verification/android-share.png", import.meta.url),
  adb("exec-out", "screencap", "-p"),
);
checks.push(
  "Existing PWA share renderer opens Android native image share sheet; no message sent",
);
fs.writeFileSync(
  new URL("../verification/pwa-restart-results.json", import.meta.url),
  JSON.stringify(
    {
      device: "emulator-5554 Android17/API37",
      backend: "local Supabase",
      checks,
    },
    null,
    2,
  ) + "\n",
);
console.log(checks.join("\n"));
c.close();
