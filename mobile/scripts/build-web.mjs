import { build } from "../../node_modules/vite/dist/node/index.js";
import { parse } from "../../node_modules/dotenv/lib/main.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const mobile = fileURLToPath(new URL("../", import.meta.url)),
  root = path.resolve(mobile, "..");
// Never implicitly load the root production .env.local into an Android build.
const file =
  process.env.MOVENOTES_ANDROID_ENV || path.join(mobile, ".env.local");
const env = fs.existsSync(file)
  ? parse(fs.readFileSync(file))
  : parse(fs.readFileSync(path.join(root, ".env.development.local")));
for (const [key, value] of Object.entries(env))
  if (key.startsWith("VITE_")) process.env[key] = value;
const url = new URL(process.env.VITE_SUPABASE_URL || "");
const local = ["localhost", "127.0.0.1", "10.0.2.2"].includes(url.hostname);
if (!local && process.env.MOVENOTES_ALLOW_HOSTED_BUILD !== "1")
  throw Error(
    "Hosted backend build requires explicit MOVENOTES_ALLOW_HOSTED_BUILD=1. Default is local only.",
  );
process.env.VITE_PUBLIC_APP_URL =
  env.VITE_PUBLIC_APP_URL ||
  (local ? "http://localhost:5173" : "https://movenotes.app");
if (local) {
  url.hostname = "10.0.2.2";
  process.env.VITE_SUPABASE_URL = url.toString().replace(/\/$/, "");
}
if (!process.env.VITE_SUPABASE_ANON_KEY)
  throw Error("Public Supabase anonymous key is required.");
if (local && !env.VITE_MAPBOX_ACCESS_TOKEN)
  delete process.env.VITE_MAPBOX_ACCESS_TOKEN;
fs.writeFileSync(
  path.join(mobile, "verification/build-environment.json"),
  JSON.stringify(
    {
      backend: local
        ? "local Supabase / emulator host10.0.2.2"
        : "explicitly authorized hosted backend",
      source: "root index.html/src/public; no copied UI",
      serviceWorker: false,
    },
    null,
    2,
  ) + "\n",
);
process.chdir(root);
await build({
  configFile: path.join(mobile, "vite.config.ts"),
  mode: "android",
});
