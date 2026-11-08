"use client";

import { Ban, LoaderCircle, Search } from "lucide-react";
import type { FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/app/components/user-avatar";
import type { SocialProfile } from "@/src/features/social/client-api";

export function ConnectionsSearch({
  username,
  profile,
  relationshipLabel,
  loading,
  pending,
  error,
  onUsernameChange,
  onSearch,
  onRelationshipChange,
  onBlock,
}: {
  username: string;
  profile: SocialProfile | null;
  relationshipLabel: string;
  loading: boolean;
  pending: string;
  error: string;
  onUsernameChange: (value: string) => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onRelationshipChange: () => void;
  onBlock: () => void;
}) {
  return (
    <section aria-labelledby="search-title" className="max-w-2xl">
      <label className="text-base font-semibold" id="search-title">
        Find someone
      </label>
      <form className="mt-2 flex gap-2" onSubmit={onSearch}>
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            autoComplete="off"
            aria-label="Username"
            className="h-10 pl-9"
            id="social-username"
            maxLength={30}
            onChange={(event) => onUsernameChange(event.target.value)}
            placeholder="Search username"
            required
            value={username}
          />
        </div>
        <Button
          className="h-10 shrink-0"
          disabled={loading || !username.trim()}
          type="submit"
        >
          {loading ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : (
            <Search aria-hidden="true" />
          )}
          <span className="hidden sm:inline">
            {loading ? "Searching..." : "Search"}
          </span>
        </Button>
      </form>

      {error && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {profile && (
        <article className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-muted/50 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              aria-label={`Open @${profile.username}'s profile`}
              className="shrink-0 rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              href={`/u/${encodeURIComponent(profile.username)}`}
            >
              <UserAvatar
                avatar={profile.avatar}
                name={profile.name}
                size={40}
                userId={profile.id}
                username={profile.username}
              />
            </Link>
            <div className="min-w-0">
              <Link
                className="block truncate text-sm font-medium hover:underline"
                href={`/u/${encodeURIComponent(profile.username)}`}
              >
                {profile.name || `@${profile.username}`}
              </Link>
              {profile.name && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  @{profile.username}
                </p>
              )}
              {profile.bio && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {profile.bio}
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {relationshipLabel}
                {profile.links !== null && profile.links > 0
                  ? ` · ${profile.links} ${profile.links === 1 ? "link" : "links"}`
                  : ""}
              </p>
            </div>
          </div>
          {profile.relationship !== "self" && (
            <div className="flex shrink-0 flex-wrap gap-2">
              {profile.relationship !== "blocked" && (
                <Button
                  aria-busy={pending === profile.username}
                  disabled={pending === profile.username}
                  onClick={onRelationshipChange}
                  type="button"
                  variant={
                    profile.relationship === "linked" ||
                    profile.relationship === "requested"
                      ? "outline"
                      : "default"
                  }
                >
                  {pending === profile.username ? (
                    <>
                      <LoaderCircle
                        aria-hidden="true"
                        className="animate-spin"
                      />
                      Updating...
                    </>
                  ) : profile.relationship === "linked" ? (
                    "Unlink"
                  ) : profile.relationship === "requested" ? (
                    "Cancel request"
                  ) : profile.relationship === "incoming" ? (
                    "Accept link"
                  ) : (
                    "Link"
                  )}
                </Button>
              )}
              <Button
                aria-label={
                  profile.relationship === "blocked"
                    ? `Unblock ${profile.username}`
                    : `Block ${profile.username}`
                }
                className="text-muted-foreground"
                disabled={pending === profile.username}
                onClick={onBlock}
                type="button"
                variant="ghost"
              >
                <Ban aria-hidden="true" className="size-4" />
                {profile.relationship === "blocked" ? "Unblock" : "Block"}
              </Button>
            </div>
          )}
        </article>
      )}
    </section>
  );
}
