import fs from "node:fs";
import assert from "node:assert/strict";
import { attach, delay, adb } from "./webview-driver.mjs";
import { localSession } from "./local-session.mjs";
const result = {
  device: "emulator-5554 / sdk_gphone16k_x86_64",
  android: "17 / API37",
  backend: "existing local Supabase, fictional test user",
  checks: [],
  limits: [
    "Local default emails are link-only: session bootstrapped from own verification mail via CDP, not an interactive OTP verification pass",
    "No staging or provider authorization supplied",
  ],
};
let c = await attach();
const record = (s) => {
  result.checks.push(s);
  console.log(s);
  fs.writeFileSync(
    new URL("../verification/android-results.json", import.meta.url),
    JSON.stringify(result, null, 2) + "\n",
  );
};
const text = () => c.evaluate("document.body.innerText");
const wait = async (predicate) => {
  for (let i = 0; i < 80; i++) {
    if (await predicate()) return;
    await delay(250);
  }
  throw Error("Expected app state did not appear");
};
const click = async (label) => {
  const found = await c.evaluate(
    `(()=>{const e=[...document.querySelectorAll('button,a,[role="button"]')].find(e=>e.textContent.trim()===${JSON.stringify(label)}||e.getAttribute('aria-label')===${JSON.stringify(label)});if(!e)return false;e.click();return true})()`,
  );
  if (!found) throw Error("Control missing: " + label);
  await delay(300);
};
const initial = await c.evaluate(
  "({native:!!window.Capacitor,secure:isSecureContext,styles:document.styleSheets.length})",
);
assert.ok(initial.native && initial.secure && initial.styles);
record("Actual bundled PWA renders inside Capacitor secure WebView");
await c.evaluate(
  `history.pushState({},'','/login');dispatchEvent(new PopStateEvent('popstate'))`,
);
await wait(async () => String(await text()).includes("Email address"));
fs.writeFileSync(
  new URL("../verification/android-login.png", import.meta.url),
  adb("exec-out", "screencap", "-p"),
);
record("Existing PWA login screen and branding render");
const auth = await localSession();
await c.evaluate(
  `localStorage.setItem('sb-10-auth-token',${JSON.stringify(JSON.stringify(auth.session))});location.replace('/')`,
);
await delay(2500);
await wait(async () => !(await text()).includes("A private movement journal"));
console.log("Authenticated text:", String(await text()).slice(0, 1200));
record("Local Supabase verified session accepted by unchanged PWA auth");
fs.writeFileSync(
  new URL("../verification/android-authenticated.png", import.meta.url),
  adb("exec-out", "screencap", "-p"),
);
const sw = await c.evaluate(
  "navigator.serviceWorker.getRegistrations().then(r=>r.length)",
);
assert.equal(sw, 0);
record("No native service-worker registration");
fs.writeFileSync(
  new URL("../verification/local-test-user.json", import.meta.url),
  JSON.stringify({ id: auth.user.id, email: auth.user.email }, null, 2) + "\n",
);
c.close();
