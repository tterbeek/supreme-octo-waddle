import { defineConfig, type PluginOption } from "../node_modules/vite";
import web from "../vite.config";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const runtime = fileURLToPath(new URL("./src/runtime.ts", import.meta.url));
const plugins = (web.plugins || [])
  .flat(Infinity)
  .filter(
    (p: any) => p && !String(p.name || "").includes("pwa"),
  ) as PluginOption[];
export default defineConfig({
  ...web,
  root,
  envDir: fileURLToPath(new URL("./.config", import.meta.url)),
  plugins: [
    ...plugins,
    {
      name: "movenotes-capacitor-bootstrap",
      enforce: "pre",
      resolveId(source, importer) {
        if (!importer || !source.startsWith(".")) return;
        const from = importer.split("?")[0];
        const target = path
          .resolve(path.dirname(from), source)
          .replace(/\\/g, "/")
          .replace(/\.tsx?$/, "");
        if (
          target === path.join(root, "src/lib/media/getImage") &&
          !from.endsWith("/mobile/src/media.ts") &&
          !from.endsWith("/mobile/src/media-metadata.ts")
        )
          return fileURLToPath(new URL("./src/media.ts", import.meta.url));
        if (
          target === path.join(root, "src/lib/exifGps") &&
          !from.endsWith("/mobile/src/exif.ts")
        )
          return fileURLToPath(new URL("./src/exif.ts", import.meta.url));
      },
      transform(code, id) {
        if (
          id.replace(/\\/g, "/").endsWith("/src/main.tsx") &&
          id.startsWith(root)
        )
          return `import ${JSON.stringify(runtime)};\n${code}`;
        if (
          [
            "/src/pages/ManageCirclePage.tsx",
            "/src/components/social/CommunitySettings.tsx",
          ].some((p) => id.endsWith(p))
        )
          return code.replaceAll(
            "window.location.origin",
            JSON.stringify(
              process.env.VITE_PUBLIC_APP_URL || "https://movenotes.app",
            ),
          );
      },
    },
  ],
  resolve: {
    alias: {
      "virtual:pwa-register": fileURLToPath(
        new URL("./src/pwa-register.ts", import.meta.url),
      ),
    },
  },
  build: {
    outDir: fileURLToPath(new URL("./web-dist", import.meta.url)),
    emptyOutDir: true,
    sourcemap: false,
  },
  server: { host: "127.0.0.1", port: 5185 },
});
