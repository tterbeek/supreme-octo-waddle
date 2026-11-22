import { extractPhotoGps as originalPhotoGps } from "../../src/lib/exifGps.ts";
import { nativePhotoMetadata } from "./media-metadata.ts";
/** Denied native metadata must not be re-read by the PWA's EXIF fallback. */
export async function extractPhotoGps(blob: Blob) {
  const native = nativePhotoMetadata.get(blob);
  if (native && !native.allowed) return null;
  return native?.coords ?? originalPhotoGps(blob);
}
