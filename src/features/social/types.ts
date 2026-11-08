import type { Models } from "node-appwrite";

export type UserRow = Models.Row & {
  username: string;
  name: string;
  bio: string;
  avatar: string;
  private: boolean;
  links: number;
};

export type LinkRow = Models.Row & {
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

export type Relationship =
  | "self"
  | "linked"
  | "requested"
  | "incoming"
  | "not_linked"
  | "blocked";

export type PublicProfile = {
  username: string;
  name: string;
  bio: string;
  avatar: string;
  private: boolean;
  links: number | null;
  relationship: Relationship;
};

export class SocialError extends Error {
  constructor(
    readonly code: "PROFILE_NOT_FOUND" | "REQUEST_NOT_FOUND" | "BLOCKED",
  ) {
    super(code);
  }
}
