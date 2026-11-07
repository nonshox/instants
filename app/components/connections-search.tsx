"use client";

import { Ban, LoaderCircle, Search, UserRound } from "lucide-react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      <div>
        <h2 className="text-base font-semibold" id="search-title">
          Find someone
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Search by their Mono username.
        </p>
      </div>
      <form className="mt-4 flex gap-2" onSubmit={onSearch}>
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
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-background text-muted-foreground">
              <UserRound aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {profile.name || `@${profile.username}`}
              </p>
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
              </p>
            </div>
          </div>
          {profile.relationship !== "self" && (
            <div className="flex shrink-0 flex-wrap gap-2">
              {profile.relationship !== "blocked" &&
                profile.relationship !== "incoming" && (
                  <Button
                    aria-busy={pending === profile.username}
                    disabled={pending === profile.username}
                    onClick={onRelationshipChange}
                    type="button"
                    variant={
                      profile.relationship === "following" ||
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
                    ) : profile.relationship === "following" ? (
                      "Unfollow"
                    ) : profile.relationship === "requested" ? (
                      "Cancel request"
                    ) : profile.private ? (
                      "Request to follow"
                    ) : (
                      "Follow"
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
