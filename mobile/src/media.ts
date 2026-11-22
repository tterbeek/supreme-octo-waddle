import { Capacitor, registerPlugin } from "@capacitor/core";
import {
  createImageFile,
  isImagePickerCancelledError,
  getImages as browserImages,
} from "../../src/lib/media/getImage";
import type {
  ImageSource,
  ImageResult,
  ImageCoords,
} from "../../src/lib/media/getImage";
import { nativePhotoMetadata } from "./media-metadata";
export { createImageFile, isImagePickerCancelledError };
export type {
  ImageSource,
  ImageResult,
  ImageCoords,
  ImageFile,
} from "../../src/lib/media/getImage";
type NativePhoto = {
  uri: string;
  name: string;
  mimeType: string;
  metadataAllowed: boolean;
  coords?: ImageCoords;
};
const media = registerPlugin<{
  pick(options: {
    source: ImageSource;
    maxCount: number;
  }): Promise<{ images: NativePhoto[] }>;
  release(options: { uris: string[] }): Promise<void>;
}>("MoveNotesMedia");
export async function getImages(
  source: ImageSource,
  options: { maxCount?: number } = {},
): Promise<ImageResult[]> {
  if (Capacitor.getPlatform() !== "android")
    return browserImages(source, options);
  const limit = source === "camera" ? 1 : Math.min(5, options.maxCount ?? 5);
  if (limit < 1) throw Error("You can attach up to five photos.");
  const result = await media.pick({ source, maxCount: limit });
  try {
    return await Promise.all(
      result.images.map(async (photo) => {
        const response = await fetch(Capacitor.convertFileSrc(photo.uri));
        if (!response.ok)
          throw Error("Could not read the selected photo. Please try again.");
        const blob = await response.blob();
        const file = new File([blob], photo.name, { type: photo.mimeType });
        const coords = photo.metadataAllowed ? (photo.coords ?? null) : null;
        nativePhotoMetadata.set(file, {
          allowed: photo.metadataAllowed,
          coords,
        });
        return { blob: file, previewUrl: URL.createObjectURL(file), coords };
      }),
    );
  } finally {
    await media
      .release({ uris: result.images.map((photo) => photo.uri) })
      .catch(() => {});
  }
}
export async function getImage(source: ImageSource): Promise<ImageResult> {
  return (await getImages(source, { maxCount: 1 }))[0];
}
