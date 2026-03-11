import { supabase } from "../supabaseClient";
import { NOTE_STORAGE_BUCKET } from "./storage.service";

export const NOTE_BUCKET = NOTE_STORAGE_BUCKET;

export async function compressImage(file: File) {
  const maxDim = 1600;
  const quality = 0.75;

  return new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Cannot get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) {
            reject(new Error("Unable to compress image"));
          } else {
            resolve(blob);
          }
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not load image"));
    };
    img.src = objectUrl;
  });
}

export async function createThumbnail(
  file: File,
  maxSize = 480,
  quality = 0.7
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  const scale = Math.min(maxSize / bitmap.width, maxSize / bitmap.height, 1);

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("Thumbnail creation failed"));
        resolve(blob);
      },
      "image/jpeg",
      quality
    );
  });
}

export async function uploadActivityImage(
  userId: string,
  activityId: string,
  file: Blob,
  thumbnail?: Blob | null
) {
  const uniqueId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const fileName = `${activityId}-${uniqueId}.jpg`;
  const path = `${userId}/${fileName}`;
  const thumbPath = thumbnail ? `${userId}/thumb/${fileName}` : null;

  const [imageResult, thumbResult] = await Promise.all([
    supabase.storage.from(NOTE_BUCKET).upload(path, file, {
      contentType: "image/jpeg",
      upsert: true,
    }),
    thumbnail
      ? supabase.storage.from(NOTE_BUCKET).upload(thumbPath as string, thumbnail, {
          contentType: "image/jpeg",
          upsert: true,
        })
      : Promise.resolve({ error: null }),
  ]);

  if (imageResult.error) {
    throw imageResult.error;
  }

  if (thumbResult.error) {
    throw thumbResult.error;
  }

  return { imagePath: path, thumbPath };
}

export async function deleteActivityImages(paths: string[]) {
  if (paths.length === 0) return;
  await supabase.storage.from(NOTE_BUCKET).remove(paths);
}
