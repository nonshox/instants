import { describe, expect, it } from "vitest";
import {
  blockedListSchema,
  connectionListSchema,
  profileLookupSchema,
  relationshipInputSchema,
  requestListSchema,
  requestDecisionSchema,
} from "./schemas";
import { canViewProfileDetails } from "./policy";

describe("social request inputs", () => {
  it("trims and validates username lookups", () => {
    expect(profileLookupSchema.parse({ username: "  quiet.day " })).toEqual({
      username: "quiet.day",
    });
    expect(profileLookupSchema.safeParse({ username: "" }).success).toBe(false);
    expect(
      profileLookupSchema.safeParse({ username: "valid", userId: "forged" })
        .success,
    ).toBe(false);
  });

  it("accepts only explicit link-request decisions", () => {
    expect(
      requestDecisionSchema.safeParse({
        username: "quiet.day",
        action: "approve",
      }).success,
    ).toBe(true);
    expect(
      requestDecisionSchema.safeParse({
        username: "quiet.day",
        action: "cancel",
      }).success,
    ).toBe(false);
  });

  it("requires a target username for relationship changes", () => {
    expect(relationshipInputSchema.safeParse({ username: "friend" }).success)
      .toBe(true);
    expect(relationshipInputSchema.safeParse({}).success).toBe(false);
    expect(
      relationshipInputSchema.safeParse({
        username: "friend",
        userId: "forged",
      }).success,
    ).toBe(false);
  });

  it("validates paginated link and request lists", () => {
    expect(connectionListSchema.safeParse({}).success).toBe(true);
    expect(connectionListSchema.parse({ cursor: "row-1" }).cursor).toBe("row-1");
    expect(connectionListSchema.safeParse({ kind: "followers" }).success).toBe(false);
    expect(requestListSchema.parse({}).direction).toBe("received");
    expect(requestListSchema.parse({ direction: "sent", cursor: "row-1" }).direction)
      .toBe("sent");
    expect(blockedListSchema.safeParse({ cursor: "../invalid" }).success).toBe(false);
  });
});

describe("private profile visibility", () => {
  it("shows details only to the owner, linked accounts, or everyone for public accounts", () => {
    expect(canViewProfileDetails(true, true, false)).toBe(true);
    expect(canViewProfileDetails(true, false, true)).toBe(true);
    expect(canViewProfileDetails(true, false, false)).toBe(false);
    expect(canViewProfileDetails(false, false, false)).toBe(true);
  });
});
