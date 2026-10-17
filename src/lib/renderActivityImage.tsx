import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { ACTIVITY_TYPES } from "../config/activityTypes";
import { WORDMARK } from "./brand";
import type { ActivityImageModel } from "./activityImage";

const WIDTH = 1080;
const FONT = '"Nunito Sans"';

async function decodeBlob(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode(); // Browser applies source EXIF orientation on decode.
    return image;
  } finally { URL.revokeObjectURL(url); }
}

export function wrapImageTitle(text: string, measure: (s: string) => number, maxWidth: number): string[] {
  // Iterate Unicode codepoints: long unbroken words and non-Latin titles wrap too.
  const lines: string[] = [];
  let remaining = Array.from(text.replace(/\s+/g, " ").trim());
  while (remaining.length && lines.length < 3) {
    let end = 1;
    while (end < remaining.length && measure(remaining.slice(0, end + 1).join("")) <= maxWidth) end++;
    if (end < remaining.length) {
      const space = remaining.slice(0, end).lastIndexOf(" ");
      if (space > 0) end = space;
    }
    let line = remaining.slice(0, end).join("").trimEnd();
    remaining = Array.from(remaining.slice(end).join("").trimStart());
    if (lines.length === 2 && remaining.length) {
      while (line && measure(line + "…") > maxWidth) line = Array.from(line).slice(0, -1).join("").trimEnd();
      line += "…";
    }
    lines.push(line);
  }
  return lines;
}

export async function renderActivityImage(model: ActivityImageModel, photo?: Blob): Promise<File> {
  const fonts = [`600 42px ${FONT}`, `700 54px ${FONT}`, `italic 500 54px "Playfair Display"`];
  await Promise.all(fonts.map(async font => {
    const loaded = await document.fonts.load(font);
    if (!loaded.length) throw new Error("Couldn't load the MoveNotes fonts. Check your connection and retry.");
  }));
  const config = ACTIVITY_TYPES[model.type] || ACTIVITY_TYPES.other;
  // Reuse the real activity icon without shipping React's server renderer to phones.
  const holder = document.createElement("div");
  const root = createRoot(holder);
  let iconMarkup: string;
  try {
    flushSync(() => root.render(createElement(config.Icon, { size: 56, strokeWidth: 1.8 })));
    const svg = holder.querySelector("svg");
    if (!svg) throw new Error("Couldn't load the activity icon.");
    iconMarkup = new XMLSerializer().serializeToString(svg).replace(/currentColor/g, "#5A7A69");
  } finally { root.unmount(); }
  const [icon, image] = await Promise.all([
    decodeBlob(new Blob([iconMarkup], { type: "image/svg+xml" })),
    photo ? decodeBlob(photo) : Promise.resolve(null),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image export isn't supported in this browser.");
  ctx.font = `700 58px ${FONT}`;
  const lines = wrapImageTitle(model.title, text => ctx.measureText(text).width, 816);
  const photoHeight = image ? Math.round(Math.max(400, Math.min(760, 888 * image.naturalHeight / image.naturalWidth))) : 0;
  const titleY = 204;
  const dateY = titleY + lines.length * 76 + 16;
  const metricsY = dateY + 64;
  const contentBottom = model.metrics.length ? metricsY + 36 : dateY + 28;
  const photoY = contentBottom + 52;
  const footerY = (image ? photoY + photoHeight : contentBottom) + 84;
  canvas.height = footerY + 188;
  // Resetting canvas height clears context state. All drawing is explicitly styled.
  ctx.fillStyle = "#F3EDE4"; ctx.fillRect(0, 0, WIDTH, canvas.height);
  ctx.fillStyle = "#F3EEE8"; ctx.strokeStyle = "#E1DCD3"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(40, 40, WIDTH - 80, canvas.height - 80, 36); ctx.fill(); ctx.stroke();
  ctx.drawImage(icon, 512, 92, 56, 56);
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  ctx.fillStyle = "#1C1E21"; ctx.font = `700 58px ${FONT}`;
  lines.forEach((line, index) => ctx.fillText(line, WIDTH / 2, titleY + index * 76));
  ctx.fillStyle = "#66645F"; ctx.font = `600 32px ${FONT}`; ctx.fillText(model.date, WIDTH / 2, dateY);
  if (model.metrics.length) {
    ctx.fillStyle = "#374D44"; ctx.font = `600 42px ${FONT}`;
    ctx.fillText(model.metrics.join("  ·  "), WIDTH / 2, metricsY);
  }
  if (image) {
    ctx.save(); ctx.beginPath(); ctx.roundRect(96, photoY, 888, photoHeight, 24); ctx.clip();
    const scale = Math.max(888 / image.naturalWidth, photoHeight / image.naturalHeight);
    const width = image.naturalWidth * scale; const height = image.naturalHeight * scale;
    ctx.drawImage(image, 96 + (888 - width) / 2, photoY + (photoHeight - height) / 2, width, height);
    ctx.restore();
  }
  ctx.strokeStyle = "#E1DCD3"; ctx.beginPath(); ctx.moveTo(96, footerY - 30); ctx.lineTo(984, footerY - 30); ctx.stroke();
  // This is the actual HeaderLogo wordmark, not a new graphic or approximate icon.
  ctx.textAlign = "left";
  ctx.font = `${WORDMARK.move.weight} 54px "${WORDMARK.move.family}"`;
  const moveWidth = ctx.measureText(WORDMARK.move.text).width;
  ctx.font = `italic ${WORDMARK.notes.weight} 54px "${WORDMARK.notes.family}"`;
  const notesWidth = ctx.measureText(WORDMARK.notes.text).width;
  const x = (WIDTH - moveWidth - notesWidth) / 2;
  ctx.fillStyle = WORDMARK.move.color; ctx.font = `${WORDMARK.move.weight} 54px "${WORDMARK.move.family}"`; ctx.fillText(WORDMARK.move.text, x, footerY);
  ctx.fillStyle = WORDMARK.notes.color; ctx.font = `italic ${WORDMARK.notes.weight} 54px "${WORDMARK.notes.family}"`; ctx.fillText(WORDMARK.notes.text, x + moveWidth, footerY);
  ctx.textAlign = "center"; ctx.fillStyle = "#5C625D"; ctx.font = `600 32px ${FONT}`;
  ctx.fillText("https://movenotes.app", WIDTH / 2, footerY + 78);
  const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Couldn't prepare the image. Try again.")), "image/png"));
  return new File([png], "movenotes-activity.png", { type: "image/png" });
}
