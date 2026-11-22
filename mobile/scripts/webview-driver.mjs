import WebSocket from "ws";
import { execFileSync } from "node:child_process";
export const adb = (...args) =>
  execFileSync(
    "adb",
    ["-s", process.env.ANDROID_SERIAL || "emulator-5554", ...args],
    { timeout: 30000 },
  );
export const delay = (ms) => new Promise((r) => setTimeout(r, ms));
export async function attach() {
  const pid = adb("shell", "pidof", "app.movenotes.android.dev")
    .toString()
    .trim();
  adb("forward", "tcp:9223", "localabstract:webview_devtools_remote_" + pid);
  let targets;
  for (let i = 0; i < 20; i++) {
    try {
      targets = await (await fetch("http://127.0.0.1:9223/json/list")).json();
      if (targets.length) break;
    } catch {}
    await delay(300);
  }
  if (!targets?.length) throw Error("No running MoveNotes WebView");
  const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  let id = 0;
  const waiting = new Map();
  ws.on("message", (raw) => {
    const m = JSON.parse(String(raw));
    if (m.id) {
      const p = waiting.get(m.id);
      if (!p) return;
      waiting.delete(m.id);
      m.error ? p.reject(Error(m.error.message)) : p.resolve(m.result);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const i = ++id;
      waiting.set(i, { resolve, reject });
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    });
    if (r.exceptionDetails)
      throw Error(r.exceptionDetails.text || "WebView script failed");
    return r.result.value;
  };
  await send("Runtime.enable");
  return { send, evaluate, close: () => ws.close() };
}
