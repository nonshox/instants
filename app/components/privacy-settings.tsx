"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Shield, UserRound } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { fetchProfile, saveProfile, type Profile } from "@/src/features/profile/client-api";
import {
  fetchBlockedAccounts,
  updateBlock,
  type ConnectionPage,
} from "@/src/features/social/client-api";
import { getApiErrorMessage } from "@/src/lib/api-client";

type BlockedState = ConnectionPage & { loaded: boolean };

export function PrivacySettings() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [blocked, setBlocked] = useState<BlockedState>({
    items: [],
    nextCursor: null,
    loaded: false,
  });
  const [loadingBlocked, setLoadingBlocked] = useState(true);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadBlocked = async (cursor: string | null = null) => {
    setLoadingBlocked(true);
    setError("");
    try {
      const page = await fetchBlockedAccounts(cursor);
      setBlocked((current) => ({
        items: cursor ? [...current.items, ...page.items] : page.items,
        nextCursor: page.nextCursor,
        loaded: true,
      }));
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Blocked accounts could not be loaded."));
    } finally {
      setLoadingBlocked(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetchProfile()
      .then((value) => {
        if (active) setProfile(value);
      })
      .catch((cause: unknown) => {
        if (active) setError(getApiErrorMessage(cause, "Privacy settings could not be loaded."));
      })
      .finally(() => {
        if (active) setLoadingProfile(false);
      });
    fetchBlockedAccounts()
      .then((page) => {
        if (active) {
          setBlocked({ ...page, loaded: true });
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(getApiErrorMessage(cause, "Blocked accounts could not be loaded."));
        }
      })
      .finally(() => {
        if (active) setLoadingBlocked(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const togglePrivacy = async () => {
    if (!profile) return;
    setSavingPrivacy(true);
    setError("");
    setMessage("");
    const previous = profile;
    const next = { ...profile, private: !profile.private };
    setProfile(next);
    try {
      setProfile(await saveProfile({
        username: next.username,
        name: next.name,
        bio: next.bio,
        private: next.private,
      }, true));
      setMessage(next.private ? "Your account is now private." : "Your account is now public.");
    } catch (cause) {
      setProfile(previous);
      setError(getApiErrorMessage(cause, "Privacy settings could not be saved."));
    } finally {
      setSavingPrivacy(false);
    }
  };

  const unblock = async (username: string) => {
    setPending(username);
    setError("");
    setBlocked((current) => ({
      ...current,
      items: current.items.filter((item) => item.username !== username),
    }));
    try {
      await updateBlock(username, true);
      setMessage(`@${username} unblocked. Existing links were not restored.`);
    } catch (cause) {
      setError(getApiErrorMessage(cause, "The account could not be unblocked."));
      await loadBlocked();
    } finally {
      setPending("");
    }
  };

  return (
    <section aria-labelledby="privacy-title" className="mt-8">
      <header className="mb-4 flex items-center gap-3">
        <Shield aria-hidden="true" className="size-5 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold" id="privacy-title">Privacy</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage who you link with and accounts you have blocked.
          </p>
        </div>
      </header>

      <div className="rounded-xl bg-muted/35 px-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 py-4">
          <div>
            <p className="text-sm font-medium">Private account</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {profile?.private
                ? "Link requests need your acceptance before your Instants are shared."
                : "Anyone can send a link request, and you choose whether to accept."}
            </p>
          </div>
          {loadingProfile ? (
            <LoaderCircle aria-label="Loading privacy" className="size-4 animate-spin" />
          ) : profile ? (
            <Button
              disabled={savingPrivacy}
              onClick={() => void togglePrivacy()}
              type="button"
              variant="outline"
            >
              {savingPrivacy
                ? "Saving..."
                : profile.private
                  ? "Make public"
                  : "Make private"}
            </Button>
          ) : (
            <Link className="text-sm underline underline-offset-4" href="/profile">
              Create profile
            </Link>
          )}
        </div>

        <div className="py-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Blocked accounts</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Unblocking never restores links or requests.
              </p>
            </div>
            {!blocked.loaded && !loadingBlocked && (
              <Button onClick={() => void loadBlocked()} size="sm" variant="ghost">
                Load
              </Button>
            )}
          </div>
          {loadingBlocked && blocked.items.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground" role="status">Loading...</p>
          ) : blocked.loaded && blocked.items.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">No blocked accounts.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {blocked.items.map((item) => (
                <li className="flex items-center gap-3 py-3" key={item.username}>
                  <Link
                    aria-label={`Open @${item.username}'s profile`}
                    className="grid size-9 place-items-center rounded-full bg-background text-muted-foreground"
                    href={`/u/${encodeURIComponent(item.username)}`}
                  >
                    <UserRound aria-hidden="true" className="size-4" />
                  </Link>
                  <Link
                    className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                    href={`/u/${encodeURIComponent(item.username)}`}
                  >
                    {item.name || `@${item.username}`}
                  </Link>
                  <Button
                    disabled={pending === item.username}
                    onClick={() => void unblock(item.username)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {pending === item.username ? "Unblocking..." : "Unblock"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {blocked.nextCursor && (
            <Button
              className="mt-2 w-full"
              disabled={loadingBlocked}
              onClick={() => void loadBlocked(blocked.nextCursor)}
              variant="outline"
            >
              {loadingBlocked ? "Loading..." : "Load more"}
            </Button>
          )}
        </div>
      </div>
      {(error || message) && (
        <p className={`mt-3 text-sm ${error ? "text-destructive" : "text-muted-foreground"}`} role={error ? "alert" : "status"}>
          {error || message}
        </p>
      )}
    </section>
  );
}
