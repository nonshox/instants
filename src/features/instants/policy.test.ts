import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { captionSchema, localInstantIdSchema } from "./schemas";
import { InvalidInstantImageError, optimizeImage, UnsupportedImageError } from "./image";
import { canViewInstant } from "./policy";

describe("Instant inputs", () => {
  it("accepts only one-line captions with up to five words", () => {
    expect(captionSchema.safeParse("small everyday moment").success).toBe(true);
    expect(captionSchema.safeParse("one two three four five six").success).toBe(false);
    expect(captionSchema.safeParse("first line\nsecond line").success).toBe(false);
  });

  it("requires a UUID for stable local Instant IDs", () => {
    expect(localInstantIdSchema.safeParse(crypto.randomUUID()).success).toBe(true);
    expect(localInstantIdSchema.safeParse("../other").success).toBe(false);
  });
});

describe("Instant visibility", () => {
  it("requires approved following for private accounts and denies either block direction", () => {
    expect(canViewInstant(true, false, false, false)).toBe(false);
    expect(canViewInstant(true, false, true, false)).toBe(true);
    expect(canViewInstant(false, false, false, false)).toBe(true);
    expect(canViewInstant(false, true, false, true)).toBe(false);
  });
});

describe("Instant image validation", () => {
  it("re-encodes supported formats and rejects unsupported or corrupt images", async () => {
    const source = sharp({
      create: {
        width: 2,
        height: 2,
        channels: 3,
        background: { r: 120, g: 130, b: 140 },
      },
    });
    const images = await Promise.all([
      source.clone().jpeg().toBuffer(),
      source.clone().png().toBuffer(),
      source.clone().webp().toBuffer(),
    ]);

    for (const [index, input] of images.entries()) {
      const result = await optimizeImage(input);
      expect(result.mimeType).toBe(
        ["image/jpeg", "image/png", "image/webp"][index],
      );
      expect(result.buffer.byteLength).toBeGreaterThan(0);
    }

    await expect(optimizeImage(Buffer.from("not an image"))).rejects.toBeInstanceOf(
      InvalidInstantImageError,
    );
    await expect(
      optimizeImage(
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'),
      ),
    ).rejects.toBeInstanceOf(UnsupportedImageError);
  });
});
