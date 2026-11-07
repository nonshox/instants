import type { Models } from "node-appwrite";

export type UserRow = Models.Row & {
  username: string;
  name: string;
  bio: string;
  avatar: string;
  private: boolean;
  followers: number;
  following: number;
};

export type RelationshipRow = Models.Row & {
  follower: string;
  following: string;
};

export type RequestRow = Models.Row & {
  requester: string;
  target: string;
};

export type BlockRow = Models.Row & {
  blocker: string;
  blocked: string;
  created: string;
};

export type PublicProfile = {
  username: string;
  name: string;
  bio: string;
  avatar: string;
  private: boolean;
  followers: number | null;
  following: number | null;
  relationship:
    | "self"
    | "following"
    | "requested"
    | "incoming"
    | "not_following"
    | "blocked";
};

export class SocialError extends Error {
  constructor(
    readonly code: "PROFILE_NOT_FOUND" | "REQUEST_NOT_FOUND" | "BLOCKED",
  ) {
    super(code);
  }
}
