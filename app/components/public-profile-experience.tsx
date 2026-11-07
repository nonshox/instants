"use client";

import { useEffect, useState } from "react";
import { Ban, LoaderCircle, MoreHorizontal, Shield, UserRound } from "lucide-react";
import Link from "next/link";
import { Menu } from "@base-ui/react/menu";
import { Button } from "@/components/ui/button";
import {
  searchSocialProfile,
  updateBlock,
  updateRelationship,
  type SocialProfile,
} from "@/src/features/social/client-api";
import { getApiErrorMessage } from "@/src/lib/api-client";

export function PublicProfileExperience({ username }: { username: string }) {
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    searchSocialProfile(username)
      .then((value) => {
        if (active) setProfile(value);
      })
      .catch((cause: unknown) => {
        if (active) setError(getApiErrorMessage(cause, "This profile is unavailable."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [username]);

  const changeRelationship = async () => {
    if (!profile) return;
    const previous = profile;
    const remove = profile.relationship === "following" ||
      profile.relationship === "requested";
    setPending(true);
    setError("");
    setMessage("");
    if (!remove) {
      setProfile({
        ...profile,
        relationship: profile.private ? "requested" : "following",
      });
    } else {
      setProfile({ ...profile, relationship: "not_following" });
    }
    try {
      const relationship = await updateRelationship(profile.username, remove);
      if (!remove && relationship) {
        setProfile((current) => current ? { ...current, relationship } : current);
      }
      setMessage(remove ? "Connection updated." : profile.private ? "Follow request sent." : "Following.");
    } catch (cause) {
      setProfile(previous);
      setError(getApiErrorMessage(cause, "The relationship could not be updated."));
    } finally {
      setPending(false);
    }
  };

  const toggleBlock = async () => {
    if (!profile) return;
    const blocked = profile.relationship === "blocked";
    if (!blocked && !window.confirm(`Block @${profile.username}? This removes existing connections.`)) {
      return;
    }
    setPending(true);
    setError("");
    try {
      if (blocked) {
        const updated = await updateBlock(profile.username, true);
        if (!updated) throw new Error("Profile could not be refreshed.");
        setProfile(updated);
        setMessage("Account unblocked. Existing follows were not restored.");
      } else {
        await updateBlock(profile.username, false);
        setProfile({ ...profile, relationship: "blocked", name: "", bio: "" });
        setMessage(`@${profile.username} blocked.`);
      }
    } catch (cause) {
      setError(getApiErrorMessage(cause, "The block could not be updated."));
    } finally {
      setPending(false);
    }
  };

  if (loading) {
    return <p className="py-12 text-center text-sm text-muted-foreground" role="status">Loading profile...</p>;
  }
  if (!profile) {
    return <p className="py-12 text-center text-sm text-muted-foreground" role="alert">{error}</p>;
  }

  const isSelf = profile.relationship === "self";
  const isBlocked = profile.relationship === "blocked";
  return (
    <article className="mx-auto max-w-xl">
      <header className="flex items-start gap-4">
        <span className="grid size-16 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
          <UserRound aria-hidden="true" className="size-7" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">
            {profile.name || `@${profile.username}`}
          </p>
          {profile.name && <p className="text-sm text-muted-foreground">@{profile.username}</p>}
          {profile.bio && <p className="mt-2 text-sm leading-relaxed">{profile.bio}</p>}
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
            {profile.followers !== null && (
              <span><strong className="text-foreground">{profile.followers}</strong> followers</span>
            )}
            {profile.following !== null && (
              <span><strong className="text-foreground">{profile.following}</strong> following</span>
            )}
            {profile.private && <span className="inline-flex items-center gap-1"><Shield className="size-3.5" /> Private</span>}
          </div>
        </div>
        {isSelf ? (
          <Button nativeButton={false} render={<Link href="/profile" />} variant="outline">
            Edit profile
          </Button>
        ) : (
          <Menu.Root>
            <Menu.Trigger
              aria-label="More profile actions"
              render={
                <Button size="icon" type="button" variant="ghost">
                  <MoreHorizontal aria-hidden="true" />
                </Button>
              }
            />
            <Menu.Portal>
              <Menu.Positioner align="end" sideOffset={4}>
                <Menu.Popup className="z-50 min-w-40 rounded-lg bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/5 outline-none">
                  <Menu.Item
                    className="flex h-9 w-full items-center gap-2 px-2 text-sm text-destructive outline-none hover:bg-muted focus:bg-muted"
                    disabled={pending}
                    onClick={() => void toggleBlock()}
                  >
                    <Ban aria-hidden="true" className="size-4" />
                    {isBlocked ? "Unblock" : "Block"}
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        )}
      </header>

      {!isSelf && (
        <div className="mt-6 flex gap-2">
          {isBlocked ? (
            <p className="text-sm text-muted-foreground">You blocked this account.</p>
          ) : profile.relationship === "incoming" ? (
            <Button nativeButton={false} render={<Link href="/connections?tab=requests" />} variant="outline">
              Review follow request
            </Button>
          ) : (
            <Button disabled={pending} onClick={() => void changeRelationship()} type="button">
              {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> :
                profile.relationship === "following" ? "Following" :
                  profile.relationship === "requested" ? "Requested" :
                    profile.private ? "Request to follow" : "Follow"}
            </Button>
          )}
        </div>
      )}
      {error && <p className="mt-4 text-sm text-destructive" role="alert">{error}</p>}
      {message && (
        <div
          className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-sm text-background shadow-lg"
          role="status"
        >
          {message}
        </div>
      )}
    </article>
  );
}
