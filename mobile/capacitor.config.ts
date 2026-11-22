import { readFileSync } from "node:fs";
import type { CapacitorConfig } from "@capacitor/cli";
const local = JSON.parse(
  readFileSync("verification/build-environment.json", "utf8"),
).backend.startsWith("local");
const config: CapacitorConfig = {
  appId: "app.movenotes.android.dev",
  appName: "MoveNotes",
  webDir: "web-dist",
  server: { androidScheme: "https", cleartext: local },
  android: {
    backgroundColor: "#f3ede4",
    allowMixedContent: local,
    webContentsDebuggingEnabled: process.env.MOVENOTES_WEBVIEW_DEBUG === "1",
  },
  plugins: { CapacitorHttp: { enabled: false } },
};
export default config;
