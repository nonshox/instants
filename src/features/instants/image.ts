import sharp from "sharp";

const SQUARE_EDGE = 1080;

export type OptimizedImage = {
  buffer: Buffer;
  extension: "jpg" | "png" | "webp";
  mimeType: "image/jpeg" | "image/png" | "image/webp";
};

export async function optimizeImage(input: Buffer): Promise<OptimizedImage> {
  let image: ReturnType<typeof sharp>;
  let format: string | undefined;
  try {
    image = sharp(input, {
      failOn: "error",
      limitInputPixels: 40_000_000,
    });
    format = (await image.metadata()).format;
  } catch {
    throw new InvalidInstantImageError();
  }

  try {
    const normalize = () =>
      image
        .rotate()
        .resize(SQUARE_EDGE, SQUARE_EDGE, {
          fit: "cover",
          position: "centre",
          withoutEnlargement: true,
        });

    switch (format) {
      case "jpeg":
        return {
          buffer: await normalize().jpeg({ quality: 90 }).toBuffer(),
          extension: "jpg",
          mimeType: "image/jpeg",
        };
      case "png":
        return {
          buffer: await normalize().png().toBuffer(),
          extension: "png",
          mimeType: "image/png",
        };
      case "webp":
        return {
          buffer: await normalize().webp({ quality: 90 }).toBuffer(),
          extension: "webp",
          mimeType: "image/webp",
        };
      default:
        throw new UnsupportedImageError();
    }
  } catch (error) {
    if (error instanceof UnsupportedImageError) {
      throw error;
    }
    throw new InvalidInstantImageError();
  }
}

export class InvalidInstantImageError extends Error {
  constructor() {
    super("That photo can't be used. Try another one.");
    this.name = "InvalidInstantImageError";
  }
}

export class UnsupportedImageError extends Error {
  constructor() {
    super("That photo can't be used. Try another one.");
    this.name = "UnsupportedImageError";
  }
}
