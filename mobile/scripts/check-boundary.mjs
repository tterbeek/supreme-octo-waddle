import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const previous = JSON.parse(
  fs.readFileSync(new URL("../verification/baseline.json", import.meta.url)),
);
const current = {};
function scan(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      [".git", "mobile", "node_modules", "dist"].includes(e.name) ||
      e.name.startsWith(".env")
    )
      continue;
    const file = path.join(dir, e.name),
      key = path.relative(root, file);
    if (e.isSymbolicLink()) current[key] = "symlink:" + fs.readlinkSync(file);
    else if (e.isDirectory()) scan(file);
    else if (e.isFile())
      current[key] = crypto
        .createHash("sha256")
        .update(fs.readFileSync(file))
        .digest("hex");
  }
}
scan(root);
const result = {
  changed: Object.keys(previous).filter((k) => current[k] !== previous[k]),
  added: Object.keys(current).filter((k) => !(k in previous)),
};
result.pass = !result.changed.length && !result.added.length;
fs.writeFileSync(
  new URL("../verification/boundary-results.json", import.meta.url),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(result);
if (!result.pass) process.exitCode = 1;
