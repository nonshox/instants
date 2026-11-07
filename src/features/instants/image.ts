import sharp from "sharp";

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
    switch (format) {
      case "jpeg":
        return {
          buffer: await image.rotate().jpeg({ quality: 90 }).toBuffer(),
          extension: "jpg",
          mimeType: "image/jpeg",
        };
      case "png":
        return {
          buffer: await image.rotate().png().toBuffer(),
          extension: "png",
          mimeType: "image/png",
        };
      case "webp":
        return {
          buffer: await image.rotate().webp({ quality: 90 }).toBuffer(),
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
    super("The selected file is not a valid supported image.");
  }
}

export class UnsupportedImageError extends Error {
  constructor() {
    super("Only valid JPEG, PNG, and WebP images are supported.");
  }
}
