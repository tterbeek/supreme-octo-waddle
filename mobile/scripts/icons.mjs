import sharp from "../../node_modules/sharp/lib/index.js";
import fs from "node:fs";
const source = new URL("../../public/icon-512.png", import.meta.url);
for (const [density, size] of Object.entries({
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
})) {
  const dir = new URL(
    `../android/app/src/main/res/mipmap-${density}/`,
    import.meta.url,
  );
  fs.mkdirSync(dir, { recursive: true });
  for (const name of [
    "ic_launcher.png",
    "ic_launcher_round.png",
    "ic_launcher_foreground.png",
  ])
    await sharp(source.pathname)
      .resize(size, size)
      .png()
      .toFile(new URL(name, dir).pathname);
}
// Reuse the PWA icon on Capacitor's Android launch screen as well.
for (const folder of fs.readdirSync(
  new URL("../android/app/src/main/res/", import.meta.url),
)) {
  const file = new URL(
    `../android/app/src/main/res/${folder}/splash.png`,
    import.meta.url,
  );
  if (!fs.existsSync(file)) continue;
  const meta = await sharp(file.pathname).metadata();
  const size = Math.round(Math.min(meta.width, meta.height) * 0.25);
  const icon = await sharp(source.pathname).resize(size, size).png().toBuffer();
  await sharp({
    create: {
      width: meta.width,
      height: meta.height,
      channels: 4,
      background: "#f3ede4",
    },
  })
    .composite([{ input: icon, gravity: "center" }])
    .png()
    .toFile(file.pathname + ".new");
  fs.renameSync(file.pathname + ".new", file.pathname);
}
