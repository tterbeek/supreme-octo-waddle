import fs from "node:fs";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { parse } from "dotenv";
import { attach, delay, adb } from "./webview-driver.mjs";
let c = await attach();
const checks = [];
const record = (s) => {
  checks.push(s);
  console.log(s);
};
const text = () => c.evaluate("document.body.innerText");
const click = async (label) => {
  const ok = await c.evaluate(
    `(()=>{const all=[...document.querySelectorAll('[aria-modal="true"]')];const scope=all.at(-1)||document;const b=[...scope.querySelectorAll('button,a,[role="button"]')].find(b=>b.textContent.trim()===${JSON.stringify(label)}||b.getAttribute('aria-label')===${JSON.stringify(label)});if(!b)return false;b.click();return true;})()`,
  );
  if (!ok) throw Error("Button missing: " + label);
  await delay(400);
};
const set = async (selector, value) =>
  c.evaluate(
    `(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('Missing field');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
if (!(await c.evaluate('!!document.querySelector("#activity-title")')))
  await click("Walk");
await delay(400);
console.log(
  "FIELDS",
  await c.evaluate(
    `JSON.stringify([...document.querySelectorAll('input')].map(e=>({id:e.id,type:e.type,placeholder:e.placeholder})))`,
  ),
);
await set("#activity-title", "Capacitor local walk");
await set('input[placeholder="Duration in min"]', "30");
await delay(300);
adb("shell", "input", "keyevent", "4");
await delay(300);
assert.ok((await text()).includes("Discard"));
await click("Keep editing");
assert.equal(
  await c.evaluate('document.querySelector("#activity-title").value'),
  "Capacitor local walk",
);
record("Android Back uses existing unsaved-change protection");
await click("Save activity");
await delay(1300);
console.log("AFTER SAVE", await text());
const env = parse(
  fs.readFileSync(new URL("../../.env.development.local", import.meta.url)),
);
const nativeSession = JSON.parse(
  await c.evaluate('localStorage.getItem("sb-10-auth-token")'),
);
const api = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
await api.auth.setSession(nativeSession);
const rows = await api
  .from("activities")
  .select("id,title,type")
  .eq("title", "Capacitor local walk");
assert.ifError(rows.error);
assert.equal(rows.data.length, 1);
record("Original Quick Log creates exactly one real local activity");
fs.writeFileSync(
  new URL("../verification/android-save.png", import.meta.url),
  adb("exec-out", "screencap", "-p"),
);
fs.writeFileSync(
  new URL("../verification/pwa-save-results.json", import.meta.url),
  JSON.stringify(
    { backend: "local Supabase", checks, activityId: rows.data[0].id },
    null,
    2,
  ) + "\n",
);
c.close();
