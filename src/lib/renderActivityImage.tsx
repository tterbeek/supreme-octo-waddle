import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { ACTIVITY_TYPES } from "../config/activityTypes";
import { WORDMARK } from "./brand";
import type { ActivityImageModel } from "./activityImage";
import { activitySources } from "../config/activitySources";

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

export async function renderActivityImage(model: ActivityImageModel, photo?: Blob, imageKind: 'photo' | 'map' = 'photo'): Promise<File> {
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
  const source = model.source ? activitySources[model.source] : undefined;
  let sourceMarkup: string | undefined;
  if (source?.icon) {
    const sourceHolder = document.createElement("div");
    const sourceRoot = createRoot(sourceHolder);
    try {
      flushSync(() => sourceRoot.render(createElement(source.icon!, { size: 32, strokeWidth: 1.4 })));
      const svg = sourceHolder.querySelector("svg");
      if (svg) sourceMarkup = new XMLSerializer().serializeToString(svg).replace(/currentColor/g, "#858780");
    } finally { sourceRoot.unmount(); }
  }
  const [icon, image, sourceIcon] = await Promise.all([
    decodeBlob(new Blob([iconMarkup], { type: "image/svg+xml" })),
    photo ? decodeBlob(photo) : Promise.resolve(null),
    sourceMarkup ? decodeBlob(new Blob([sourceMarkup], { type: "image/svg+xml" })) : Promise.resolve(null),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image export isn't supported in this browser.");
  ctx.font = `700 58px ${FONT}`;
  const lines = wrapImageTitle(model.title, text => ctx.measureText(text).width, 816);
  // Keep the decoded photo's aspect ratio, including EXIF orientation. A fixed
  // height limit turned portrait photos into cropped landscape frames.
  const photoHeight = image ? Math.round(888 * image.naturalHeight / image.naturalWidth) : 0;
  const titleY = 204;
  const dateY = titleY + lines.length * 76 + 16;
  const metricsY = dateY + 64;
  const metricsBottom = model.metrics.length ? metricsY + 36 : dateY + 28;
  const sourceY = metricsBottom + 30;
  const contentBottom = source ? sourceY + 32 : metricsBottom;
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
  if (source) {
    const label = `Imported from ${source.label}`;
    ctx.font = `600 30px ${FONT}`; ctx.fillStyle = "#858780";
    const iconWidth = sourceIcon ? 42 : 0;
    const left = (WIDTH - ctx.measureText(label).width - iconWidth) / 2;
    if (sourceIcon) ctx.drawImage(sourceIcon, left, sourceY, 32, 32);
    ctx.textAlign = "left"; ctx.fillText(label, left + iconWidth, sourceY);
    ctx.textAlign = "center";
  }
  if (image) {
    ctx.save();
    // Preserve the complete map image, including its corner logo/attribution.
    if (imageKind === 'photo') { ctx.beginPath(); ctx.roundRect(96, photoY, 888, photoHeight, 24); ctx.clip(); }
    ctx.drawImage(image, 96, photoY, 888, photoHeight);
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
