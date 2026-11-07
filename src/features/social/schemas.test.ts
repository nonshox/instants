import { describe, expect, it } from "vitest";
import {
  profileLookupSchema,
  relationshipInputSchema,
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

  it("accepts only explicit follow-request decisions", () => {
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
});

describe("private profile visibility", () => {
  it("shows details only to the owner, approved followers, or everyone for public accounts", () => {
    expect(canViewProfileDetails(true, true, false)).toBe(true);
    expect(canViewProfileDetails(true, false, true)).toBe(true);
    expect(canViewProfileDetails(true, false, false)).toBe(false);
    expect(canViewProfileDetails(false, false, false)).toBe(true);
  });
});
