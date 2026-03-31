import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

export type ImageSource = "camera" | "library";

export type ImageCoords = {
  lat: number;
  lng: number;
};

export type ImageResult = {
  blob: Blob;
  previewUrl: string;
  coords?: ImageCoords | null;
};

export type ImageFile = File & {
  coords?: ImageCoords | null;
};

type GetImagesOptions = {
  maxCount?: number;
};

const isNative = Capacitor.isNativePlatform();

const nativeSourceByImageSource: Record<ImageSource, CameraSource> = {
  camera: CameraSource.Camera,
  library: CameraSource.Photos,
};

const fileExtensionByMimeType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

const toFiniteNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const toObject = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const parseRationalPart = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return null;

  if (!normalized.includes("/")) {
    return toFiniteNumber(normalized);
  }

  const [numeratorRaw, denominatorRaw] = normalized.split("/");
  const numerator = Number(numeratorRaw);
  const denominator = Number(denominatorRaw);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }
  return numerator / denominator;
};

const parseDms = (value: unknown) => {
  if (Array.isArray(value)) {
    const numbers = value
      .map((part) => {
        if (typeof part === "number") return part;
        if (typeof part === "string") return parseRationalPart(part);
        return null;
      })
      .filter((part): part is number => typeof part === "number" && Number.isFinite(part));
    return numbers.length > 0 ? numbers : null;
  }

  if (typeof value === "string" && value.includes(",")) {
    const numbers = value
      .split(",")
      .map(parseRationalPart)
      .filter((part): part is number => typeof part === "number" && Number.isFinite(part));
    return numbers.length > 0 ? numbers : null;
  }

  const numeric = toFiniteNumber(value);
  return numeric == null ? null : [numeric];
};

const applyRef = (value: number, ref: unknown) => {
  if (!Number.isFinite(value)) return null;
  const normalizedRef =
    typeof ref === "string" ? ref.trim().toUpperCase() : "";
  return normalizedRef === "S" || normalizedRef === "W" ? -value : value;
};

const parseCoordinateValue = (value: unknown, ref: unknown) => {
  const numeric = toFiniteNumber(value);
  if (numeric != null) return applyRef(numeric, ref);

  const dms = parseDms(value);
  if (!dms || dms.length === 0) return null;

  if (dms.length === 1) {
    return applyRef(dms[0], ref);
  }

  const [degrees = 0, minutes = 0, seconds = 0] = dms;
  return applyRef(degrees + minutes / 60 + seconds / 3600, ref);
};

const roundCoord = (value: number) => Math.round(value * 1e7) / 1e7;
const isNullIsland = (lat: number, lng: number) =>
  Math.abs(lat) < 1e-7 && Math.abs(lng) < 1e-7;

const parseNativeExifCoords = (exif: unknown): ImageCoords | null => {
  const exifObject = toObject(exif);
  if (!exifObject) return null;

  const gps = toObject(exifObject.GPS);

  const lat = parseCoordinateValue(
    gps?.Latitude ??
      gps?.GPSLatitude ??
      gps?.kCGImagePropertyGPSLatitude ??
      exifObject.GPSLatitude ??
      exifObject.kCGImagePropertyGPSLatitude,
    gps?.LatitudeRef ??
      gps?.GPSLatitudeRef ??
      gps?.kCGImagePropertyGPSLatitudeRef ??
      exifObject.GPSLatitudeRef ??
      exifObject.kCGImagePropertyGPSLatitudeRef
  );
  const lng = parseCoordinateValue(
    gps?.Longitude ??
      gps?.GPSLongitude ??
      gps?.kCGImagePropertyGPSLongitude ??
      exifObject.GPSLongitude ??
      exifObject.kCGImagePropertyGPSLongitude,
    gps?.LongitudeRef ??
      gps?.GPSLongitudeRef ??
      gps?.kCGImagePropertyGPSLongitudeRef ??
      exifObject.GPSLongitudeRef ??
      exifObject.kCGImagePropertyGPSLongitudeRef
  );

  if (lat == null || lng == null) return null;
  if (isNullIsland(lat, lng)) return null;
  return {
    lat: roundCoord(lat),
    lng: roundCoord(lng),
  };
};

async function getNativeImage(source: ImageSource): Promise<ImageResult> {
  const image = await Camera.getPhoto({
    source: nativeSourceByImageSource[source],
    resultType: CameraResultType.Uri,
    quality: 85,
  });

  if (!image.webPath) {
    throw new Error("Could not read image path.");
  }

  const response = await fetch(image.webPath);
  if (!response.ok) {
    throw new Error("Could not read selected image.");
  }

  const blob = await response.blob();

  return {
    blob,
    previewUrl: image.webPath,
    coords: parseNativeExifCoords(image.exif),
  };
}

async function getNativeImages({
  maxCount,
}: GetImagesOptions = {}): Promise<ImageResult[]> {
  const result = await Camera.pickImages({
    quality: 85,
    limit: maxCount,
  });

  return Promise.all(
    (result.photos || []).map(async (photo) => {
      if (!photo.webPath) {
        throw new Error("Could not read image path.");
      }

      const response = await fetch(photo.webPath);
      if (!response.ok) {
        throw new Error("Could not read selected image.");
      }

      const blob = await response.blob();
      return {
        blob,
        previewUrl: photo.webPath,
        coords: parseNativeExifCoords(photo.exif),
      };
    })
  );
}

function pickFiles(
  source: ImageSource,
  { multiple = false }: { multiple?: boolean } = {}
): Promise<File[]> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("Image picking is only available in the browser."));
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.multiple = multiple;

    if (source === "camera") {
      input.accept = "image/*";
      input.setAttribute("capture", "environment");
    }

    const cleanup = () => {
      input.onchange = null;
      input.oncancel = null;
      input.remove();
    };

    input.onchange = () => {
      const files = input.files ? Array.from(input.files) : [];
      cleanup();

      if (files.length === 0) {
        reject(new Error("Image selection cancelled."));
        return;
      }

      resolve(files);
    };

    input.oncancel = () => {
      cleanup();
      reject(new Error("Image selection cancelled."));
    };

    document.body.appendChild(input);
    input.click();
  });
}

async function getBrowserImage(source: ImageSource): Promise<ImageResult> {
  const [file] = await pickFiles(source);
  if (!file.type.startsWith("image/")) {
    throw new Error("Selected file is not an image.");
  }

  return {
    blob: file,
    previewUrl: URL.createObjectURL(file),
    coords: null,
  };
}

async function getBrowserImages(source: ImageSource): Promise<ImageResult[]> {
  const files = await pickFiles(source, { multiple: source === "library" });
  const imageFiles = files.filter((file) => file.type.startsWith("image/"));

  if (imageFiles.length === 0) {
    throw new Error("Selected file is not an image.");
  }

  return imageFiles.map((file) => ({
    blob: file,
    previewUrl: URL.createObjectURL(file),
    coords: null,
  }));
}

export async function getImage(source: ImageSource): Promise<ImageResult> {
  if (isNative) {
    return getNativeImage(source);
  }

  return getBrowserImage(source);
}

export async function getImages(
  source: ImageSource,
  options: GetImagesOptions = {}
): Promise<ImageResult[]> {
  if (source === "camera") {
    return [await getImage(source)];
  }

  if (isNative) {
    return getNativeImages(options);
  }

  return getBrowserImages(source);
}

export function isImagePickerCancelledError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";

  const normalized = message.toLowerCase();
  return normalized.includes("cancel");
}

export function createImageFile(
  blob: Blob,
  fallbackBaseName = "image",
  coords: ImageCoords | null = null
): ImageFile {
  const file: ImageFile =
    blob instanceof File
      ? blob
      : new File([blob], `${fallbackBaseName}.${fileExtensionByMimeType[blob.type] || "jpg"}`, {
          type: blob.type || "image/jpeg",
        });

  if (coords) {
    file.coords = coords;
  }

  return file;
}
