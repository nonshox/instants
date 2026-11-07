import { describe, expect, it } from "vitest";
import {
  notificationCursorSchema,
  notificationIdSchema,
  readNotificationsSchema,
} from "./schemas";

describe("notification inputs", () => {
  it("accepts valid Appwrite row IDs and rejects malformed cursors", () => {
    expect(notificationIdSchema.safeParse("notification_123").success).toBe(true);
    expect(notificationCursorSchema.safeParse("../other").success).toBe(false);
    expect(notificationIdSchema.safeParse("x".repeat(37)).success).toBe(false);
  });

  it("accepts bounded unique read IDs and rejects extra or duplicate fields", () => {
    expect(readNotificationsSchema.safeParse({ ids: ["one", "two"] }).success)
      .toBe(true);
    expect(readNotificationsSchema.safeParse({ ids: ["one", "one"] }).success)
      .toBe(false);
    expect(readNotificationsSchema.safeParse({ ids: ["one"], userId: "forged" }).success)
      .toBe(false);
    expect(
      readNotificationsSchema.safeParse({ ids: Array(51).fill("notification") })
        .success,
    ).toBe(false);
  });
});
