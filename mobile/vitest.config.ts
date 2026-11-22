import { fileURLToPath } from "node:url";
export default {
  root: fileURLToPath(new URL("../", import.meta.url)),
  cacheDir: fileURLToPath(new URL("./.cache/vitest", import.meta.url)),
  test: { exclude: ["**/node_modules/**", "**/.git/**", "mobile/**"] },
};
