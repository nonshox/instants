const MAX_SQUARE_EDGE = 1440;
const OUTPUT_QUALITY = 0.9;

const OUTPUT_FORMATS: Record<
  string,
  { mimeType: "image/jpeg" | "image/png" | "image/webp"; extension: string }
> = {
  "image/jpeg": { mimeType: "image/jpeg", extension: "jpg" },
  "image/png": { mimeType: "image/png", extension: "png" },
  "image/webp": { mimeType: "image/webp", extension: "webp" },
};

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
};

/**
 * Crops a photo to a centered square so every Instant is 1:1 from the moment
 * it is captured or selected, through upload, archive, and feed display.
 */
export async function prepareSquareImage(file: File): Promise<File> {
  const format = OUTPUT_FORMATS[file.type];
  if (!format) {
    return file;
  }

  const image = await decodeImage(file);
  try {
    const side = Math.min(image.width, image.height);
    if (side <= 0) {
      throw new SquareImageError();
    }

    const outputEdge = Math.min(side, MAX_SQUARE_EDGE);
    const alreadySquare =
      image.width === image.height && outputEdge === side;
    if (alreadySquare) {
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = outputEdge;
    canvas.height = outputEdge;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new SquareImageError();
    }

    if (format.mimeType === "image/jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, outputEdge, outputEdge);
    }
    context.imageSmoothingQuality = "high";
    context.drawImage(
      image.source,
      (image.width - side) / 2,
      (image.height - side) / 2,
      side,
      side,
      0,
      0,
      outputEdge,
      outputEdge,
    );

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, format.mimeType, OUTPUT_QUALITY),
    );
    if (!blob) {
      throw new SquareImageError();
    }

    return new File([blob], withExtension(file.name, format.extension), {
      type: blob.type || format.mimeType,
      lastModified: file.lastModified,
    });
  } finally {
    image.dispose();
  }
}

export class SquareImageError extends Error {
  constructor() {
    super("This photo could not be read. Choose a different image and try again.");
  }
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      };
    } catch {
      // Fall through to the <img> decoder below.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const element = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new SquareImageError());
      image.src = url;
    });
    return {
      source: element,
      width: element.naturalWidth,
      height: element.naturalHeight,
      dispose: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error instanceof SquareImageError ? error : new SquareImageError();
  }
}

function withExtension(name: string, extension: string): string {
  const base = name.replace(/\.[^./\\]+$/, "") || "instant";
  return `${base}.${extension}`;
}
