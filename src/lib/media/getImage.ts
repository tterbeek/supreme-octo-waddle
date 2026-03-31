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

const fileExtensionByMimeType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

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
    input.accept = "image/*";
    input.multiple = multiple;

    if (source === "camera") {
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
  return {
    blob: file,
    previewUrl: URL.createObjectURL(file),
    coords: null,
  };
}

async function getBrowserImages(
  source: ImageSource,
  options: GetImagesOptions = {}
): Promise<ImageResult[]> {
  const files = await pickFiles(source, { multiple: source === "library" });
  const maxCount = options.maxCount ?? files.length;

  return files.slice(0, maxCount).map((file) => ({
    blob: file,
    previewUrl: URL.createObjectURL(file),
    coords: null,
  }));
}

export async function getImage(source: ImageSource): Promise<ImageResult> {
  return getBrowserImage(source);
}

export async function getImages(
  source: ImageSource,
  options: GetImagesOptions = {}
): Promise<ImageResult[]> {
  if (source === "camera") {
    return [await getImage(source)];
  }

  return getBrowserImages(source, options);
}

export function isImagePickerCancelledError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";

  return message.toLowerCase().includes("cancel");
}

export function createImageFile(
  blob: Blob,
  fallbackBaseName = "image",
  coords: ImageCoords | null = null
): ImageFile {
  const file: ImageFile =
    blob instanceof File
      ? blob
      : new File(
          [blob],
          `${fallbackBaseName}.${fileExtensionByMimeType[blob.type] || "jpg"}`,
          {
            type: blob.type || "image/jpeg",
          }
        );

  if (coords) {
    file.coords = coords;
  }

  return file;
}
