import { supabase } from "../supabaseClient";

export const NOTE_BUCKET = "actvity-notes";

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

export async function uploadActivityImage(
  userId: string,
  activityId: string,
  file: Blob
) {
  const path = `${userId}/${activityId}-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(NOTE_BUCKET)
    .upload(path, file, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (error) {
    throw error;
  }

  return path;
}

export async function deleteActivityImages(paths: string[]) {
  if (paths.length === 0) return;
  await supabase.storage.from(NOTE_BUCKET).remove(paths);
}
