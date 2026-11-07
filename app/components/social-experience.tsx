"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ConnectionsSearch } from "@/app/components/connections-search";
import {
  SocialListPanel,
  type SocialListKind,
} from "@/app/components/social-list-panel";
import {
  decideFollowRequest,
  fetchConnections,
  fetchFollowRequests,
  searchSocialProfile,
  updateBlock,
  updateRelationship,
  removeIncomingFollower,
  type ConnectionPage,
  type SocialProfile,
} from "@/src/features/social/client-api";
import { getApiErrorMessage } from "@/src/lib/api-client";

type MainTab = "followers" | "following" | "requests";
type ListState = ConnectionPage & { loaded: boolean };
const emptyList: ListState = { items: [], nextCursor: null, loaded: false };

export function SocialExperience({
  initialTab = "followers",
}: {
  initialTab?: MainTab;
}) {
  const [username, setUsername] = useState("");
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [mainTab, setMainTab] = useState<MainTab>(initialTab);
  const [requestTab, setRequestTab] = useState<"received" | "sent">("received");
  const [lists, setLists] = useState<Record<SocialListKind, ListState>>({
    followers: { ...emptyList },
    following: { ...emptyList },
    received: { ...emptyList },
    sent: { ...emptyList },
  });
  const [loadingKey, setLoadingKey] = useState<SocialListKind | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const activeKey: SocialListKind =
    mainTab === "requests" ? requestTab : mainTab;
  const activeList = lists[activeKey];

  const loadList = useCallback(async (
    key: SocialListKind,
    cursor: string | null = null,
    append = false,
  ) => {
    if (append) setLoadingMore(true);
    else setLoadingKey(key);
    setError("");
    try {
      const page = key === "followers" || key === "following"
        ? await fetchConnections(key, cursor)
        : await fetchFollowRequests(key, cursor);
      setLists((current) => ({
        ...current,
        [key]: {
          items: append
            ? [...current[key].items, ...page.items]
            : page.items,
          nextCursor: page.nextCursor,
          count: page.count,
          loaded: true,
        },
      }));
    } catch (cause) {
      setError(getApiErrorMessage(cause, "This list could not be loaded."));
    } finally {
      if (append) setLoadingMore(false);
      else setLoadingKey(null);
    }
  }, []);

  useEffect(() => {
    if (activeList.loaded) return;
    let active = true;
    void (async () => {
      try {
        const page = activeKey === "followers" || activeKey === "following"
          ? await fetchConnections(activeKey)
          : await fetchFollowRequests(activeKey);
        if (active) {
          setLists((current) => ({
            ...current,
            [activeKey]: { ...page, loaded: true },
          }));
        }
      } catch (cause) {
        if (active) {
          setError(getApiErrorMessage(cause, "This list could not be loaded."));
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [activeKey, activeList.loaded, loadList]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  const findProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearching(true);
    setProfile(null);
    setSearchError("");
    try {
      setProfile(await searchSocialProfile(username.trim()));
    } catch (cause) {
      setSearchError(getApiErrorMessage(cause, "We could not find that account."));
    } finally {
      setSearching(false);
    }
  };

  const removeOptimistically = async (
    key: SocialListKind,
    target: string,
    action: () => Promise<void>,
    successMessage: string,
  ) => {
    const previous = lists[key];
    setLists((current) => ({
      ...current,
      [key]: {
        ...current[key],
        items: current[key].items.filter((item) => item.username !== target),
        count: current[key].count === undefined
          ? undefined
          : Math.max(0, current[key].count - 1),
      },
    }));
    setPending(target);
    setError("");
    try {
      await action();
      showToast(successMessage);
    } catch (cause) {
      setLists((current) => ({ ...current, [key]: previous }));
      setError(getApiErrorMessage(cause, "The connection could not be updated."));
    } finally {
      setPending("");
    }
  };

  const followBack = async (target: string) => {
    const previous = lists.followers;
    setPending(target);
    setError("");
    setLists((current) => ({
      ...current,
      followers: {
        ...current.followers,
        items: current.followers.items.map((item) =>
          item.username === target
            ? {
                ...item,
                relationship: item.private ? "requested" : "following",
              }
            : item,
        ),
      },
    }));
    try {
      await updateRelationship(target, false);
      showToast("Connection updated.");
    } catch (cause) {
      setLists((current) => ({ ...current, followers: previous }));
      setError(getApiErrorMessage(cause, "Follow could not be completed."));
    } finally {
      setPending("");
    }
  };

  const blockUser = async (target: string) => {
    if (!window.confirm(`Block @${target}? This also removes existing connections.`)) {
      return;
    }
    const previous = lists;
    setPending(target);
    setError("");
    const removeTarget = (list: ListState): ListState => ({
      ...list,
      items: list.items.filter((item) => item.username !== target),
    });
    setLists((current) => ({
      followers: removeTarget(current.followers),
      following: removeTarget(current.following),
      received: removeTarget(current.received),
      sent: removeTarget(current.sent),
    }));
    try {
      await updateBlock(target, false);
      setProfile((current) => current?.username === target
        ? { ...current, relationship: "blocked", name: "", bio: "" }
        : current);
      showToast(`@${target} blocked.`);
    } catch (cause) {
      setLists(previous);
      setError(getApiErrorMessage(cause, "The account could not be blocked."));
    } finally {
      setPending("");
    }
  };

  const toggleSearchBlock = async () => {
    if (!profile) return;
    const target = profile.username;
    const unblock = profile.relationship === "blocked";
    if (unblock) {
      setPending(target);
      setError("");
      try {
        await updateBlock(target, true);
        setProfile(await searchSocialProfile(target));
        showToast(`@${target} unblocked. Existing follows were not restored.`);
      } catch (cause) {
        setError(getApiErrorMessage(cause, "The account could not be unblocked."));
      } finally {
        setPending("");
      }
      return;
    }
    await blockUser(target);
  };

  const decideRequest = async (
    target: string,
    action: "approve" | "reject",
  ) => removeOptimistically(
    "received",
    target,
    () => decideFollowRequest(target, action),
    action === "approve" ? "Request accepted." : "Request rejected.",
  );

  const relationshipLabel = profile
    ? {
        self: "This is your account",
        following: "Following",
        requested: "Request sent",
        incoming: "This person requested to follow you",
        not_following: profile.private ? "Private account" : "Public account",
        blocked: "You blocked this account",
      }[profile.relationship]
    : "";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-7">
      <header>
        <p className="mb-1 text-sm text-muted-foreground">Your circle</p>
        <h1 className="text-2xl font-semibold tracking-tight">Connections</h1>
      </header>
      <ConnectionsSearch
        error={searchError}
        loading={searching}
        onBlock={() => void toggleSearchBlock()}
        onRelationshipChange={() => {
          if (!profile) return;
          const target = profile.username;
          const remove = profile.relationship === "following" ||
            profile.relationship === "requested";
          setPending(target);
          void updateRelationship(target, remove)
            .then((relationship) => {
              setProfile((current) => current
                ? { ...current, relationship: relationship ?? "not_following" }
                : current);
              showToast(remove ? "Connection updated." : "Request sent.");
            })
            .catch((cause: unknown) =>
              setError(getApiErrorMessage(cause, "The relationship could not be updated.")),
            )
            .finally(() => setPending(""));
        }}
        onSearch={(event) => void findProfile(event)}
        onUsernameChange={setUsername}
        pending={pending}
        profile={profile}
        relationshipLabel={relationshipLabel}
        username={username}
      />

      <section aria-label="Connection lists">
        <div
          aria-label="Connection lists"
          className="grid grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1"
          role="tablist"
        >
          {(["followers", "following", "requests"] as const).map((tab) => (
            <button
              aria-selected={mainTab === tab}
              className={`min-h-10 rounded-lg px-2 text-sm font-medium transition-colors ${
                mainTab === tab
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              key={tab}
              onClick={() => setMainTab(tab)}
              role="tab"
              type="button"
            >
              {tab === "followers" ? "Followers" : tab === "following" ? "Following" : "Requests"}
              {tab === "requests" && (lists.received.count ?? 0) > 0 && (
                <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                  {lists.received.count}
                </span>
              )}
            </button>
          ))}
        </div>
        {mainTab === "requests" && (
          <div aria-label="Follow requests" className="mt-3 flex gap-4 border-b border-border/60 px-1" role="tablist">
            {(["received", "sent"] as const).map((tab) => (
              <button
                aria-selected={requestTab === tab}
                className={`-mb-px border-b-2 px-1 py-2 text-sm ${
                  requestTab === tab
                    ? "border-foreground font-medium text-foreground"
                    : "border-transparent text-muted-foreground"
                }`}
                key={tab}
                onClick={() => setRequestTab(tab)}
                role="tab"
                type="button"
              >
                {tab === "received" ? "Received" : "Sent"}
              </button>
            ))}
          </div>
        )}
        {error && !searching && (
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-sm text-destructive" role="alert">{error}</p>
            <button
              className="text-sm underline underline-offset-4"
              onClick={() => void loadList(activeKey)}
              type="button"
            >
              Try again
            </button>
          </div>
        )}
        <SocialListPanel
          items={activeList.items}
          kind={activeKey}
          loading={loadingKey === activeKey || !activeList.loaded}
          loadingMore={loadingMore}
          nextCursor={activeList.nextCursor}
          onBlock={(target) => void blockUser(target)}
          onCancelRequest={(target) =>
            void removeOptimistically(
              "sent",
              target,
              () => updateRelationship(target, true).then(() => undefined),
              "Request cancelled.",
            )
          }
          onDecide={(target, action) => void decideRequest(target, action)}
          onFollow={(target) => void followBack(target)}
          onLoadMore={() => {
            if (activeList.nextCursor) {
              void loadList(activeKey, activeList.nextCursor, true);
            }
          }}
          onRemoveFollower={(target) => void removeOptimistically(
            "followers",
            target,
            () => removeIncomingFollower(target),
            "Follower removed.",
          )}
          onUnfollow={(target) => void removeOptimistically(
            "following",
            target,
            () => updateRelationship(target, true).then(() => undefined),
            "Unfollowed.",
          )}
          pending={pending}
        />
      </section>
      {toast && (
        <div
          className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-sm text-background shadow-lg"
          role="status"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
