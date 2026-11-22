import type { ImageCoords } from "../../src/lib/media/getImage";
export const nativePhotoMetadata = new WeakMap<
  Blob,
  { allowed: boolean; coords: ImageCoords | null }
>();
