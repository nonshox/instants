"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ConnectionsSearch } from "@/app/components/connections-search";
import {
  SocialListSection,
  type SocialSectionKind,
} from "@/app/components/social-list-panel";
import {
  decideLinkRequest,
  fetchLinks,
  fetchLinkRequests,
  removeLink,
  requestLink,
  searchSocialProfile,
  updateBlock,
  type ConnectionItem,
  type ConnectionPage,
  type SocialProfile,
} from "@/src/features/social/client-api";
import { getApiErrorMessage } from "@/src/lib/api-client";

type ListState = ConnectionPage & { loaded: boolean };
const emptyList: ListState = { items: [], nextCursor: null, loaded: false };
const emptyLoading: Record<SocialSectionKind, boolean> = {
  links: false,
  received: false,
  sent: false,
};

export function SocialExperience() {
  const [username, setUsername] = useState("");
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [lists, setLists] = useState<Record<SocialSectionKind, ListState>>({
    links: { ...emptyList },
    received: { ...emptyList },
    sent: { ...emptyList },
  });
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] =
    useState<Record<SocialSectionKind, boolean>>(emptyLoading);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const fetchAll = useCallback(async () => {
    const [links, received, sent] = await Promise.all([
      fetchLinks(),
      fetchLinkRequests("received"),
      fetchLinkRequests("sent"),
    ]);
    return { links, received, sent };
  }, []);

  const applyPages = useCallback(
    (pages: {
      links: ConnectionPage;
      received: ConnectionPage;
      sent: ConnectionPage;
    }) => {
      setLists({
        links: { ...pages.links, loaded: true },
        received: { ...pages.received, loaded: true },
        sent: { ...pages.sent, loaded: true },
      });
    },
    [],
  );

  const loadAll = useCallback(async () => {
    setInitialLoading(true);
    setError("");
    try {
      applyPages(await fetchAll());
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Your links could not be loaded."));
    } finally {
      setInitialLoading(false);
    }
  }, [applyPages, fetchAll]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const pages = await fetchAll();
        if (active) applyPages(pages);
      } catch (cause) {
        if (active) {
          setError(getApiErrorMessage(cause, "Your links could not be loaded."));
        }
      } finally {
        if (active) setInitialLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [applyPages, fetchAll]);

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

  const loadMore = async (key: SocialSectionKind) => {
    const list = lists[key];
    if (!list.nextCursor || loadingMore[key]) return;
    setLoadingMore((current) => ({ ...current, [key]: true }));
    setError("");
    try {
      const page = key === "links"
        ? await fetchLinks(list.nextCursor)
        : await fetchLinkRequests(key, list.nextCursor);
      setLists((current) => ({
        ...current,
        [key]: {
          ...current[key],
          items: [...current[key].items, ...page.items],
          nextCursor: page.nextCursor,
          count: page.count,
          loaded: true,
        },
      }));
    } catch (cause) {
      setError(getApiErrorMessage(cause, "More accounts could not be loaded."));
    } finally {
      setLoadingMore((current) => ({ ...current, [key]: false }));
    }
  };

  const removeOptimistically = async (
    key: SocialSectionKind,
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
      return true;
    } catch (cause) {
      setLists((current) => ({ ...current, [key]: previous }));
      setError(getApiErrorMessage(cause, "The link could not be updated."));
      return false;
    } finally {
      setPending("");
    }
  };

  const addLinkToList = (item: ConnectionItem) => {
    setLists((current) => {
      const wasReceived = current.received.items.some(
        (entry) => entry.username === item.username,
      );
      return {
        ...current,
        received: {
          ...current.received,
          items: current.received.items.filter(
            (entry) => entry.username !== item.username,
          ),
          count: current.received.count === undefined
            ? undefined
            : Math.max(0, current.received.count - (wasReceived ? 1 : 0)),
        },
        sent: {
          ...current.sent,
          items: current.sent.items.filter(
            (entry) => entry.username !== item.username,
          ),
        },
        links: current.links.loaded
          ? {
              ...current.links,
              items: [
                item,
                ...current.links.items.filter(
                  (entry) => entry.username !== item.username,
                ),
              ],
            }
          : current.links,
      };
    });
  };

  const changeSearchRelationship = async () => {
    if (!profile) return;
    const target = profile;
    const remove =
      target.relationship === "linked" || target.relationship === "requested";
    const wasLinked = target.relationship === "linked";
    const previousLists = lists;
    const previousRelationship = target.relationship;

    setPending(target.username);
    setError("");

    // Optimistic: flip the button and lists instantly, roll back on failure.
    if (remove) {
      setProfile({ ...target, relationship: "not_linked" });
      setLists((current) => ({
        ...current,
        links: {
          ...current.links,
          items: current.links.items.filter(
            (item) => item.username !== target.username,
          ),
        },
        sent: {
          ...current.sent,
          items: current.sent.items.filter(
            (item) => item.username !== target.username,
          ),
        },
      }));
    } else if (target.relationship === "incoming") {
      setProfile({ ...target, relationship: "linked" });
    } else {
      setProfile({ ...target, relationship: "requested" });
    }

    try {
      if (remove) {
        await removeLink(target.username);
        showToast(wasLinked ? "Link removed." : "Link request cancelled.");
        return;
      }
      const status = await requestLink(target.username);
      setProfile((current) =>
        current ? { ...current, relationship: status } : current,
      );
      if (status === "linked") {
        addLinkToList({
          id: target.id,
          username: target.username,
          name: target.name,
          private: target.private,
          avatar: target.avatar,
        });
        showToast("Linked.");
      } else {
        showToast("Link request sent.");
      }
    } catch (cause) {
      setProfile({ ...target, relationship: previousRelationship });
      setLists(previousLists);
      setError(
        getApiErrorMessage(cause, "The link could not be updated."),
      );
    } finally {
      setPending("");
    }
  };

  const blockUser = async (target: string) => {
    if (!window.confirm(`Block @${target}? This also removes your link.`)) {
      return;
    }
    const previous = lists;
    setPending(target);
    setError("");
    const removeTarget = (list: ListState): ListState => {
      const removed = list.items.some((item) => item.username === target);
      return {
        ...list,
        items: list.items.filter((item) => item.username !== target),
        count: list.count === undefined
          ? undefined
          : Math.max(0, list.count - (removed ? 1 : 0)),
      };
    };
    setLists((current) => ({
      links: removeTarget(current.links),
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
        showToast(`@${target} unblocked. Your link was not restored.`);
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
  ) => {
    const accepted = lists.received.items.find(
      (item) => item.username === target,
    ) ?? { username: target };

    if (action === "reject") {
      await removeOptimistically(
        "received",
        target,
        () => decideLinkRequest(target, "reject"),
        "Link request declined.",
      );
      return;
    }

    const previousReceived = lists.received;
    const previousLinks = lists.links;
    setPending(target);
    setError("");
    setLists((current) => ({
      ...current,
      received: {
        ...current.received,
        items: current.received.items.filter(
          (item) => item.username !== target,
        ),
        count: current.received.count === undefined
          ? undefined
          : Math.max(0, current.received.count - 1),
      },
      links: current.links.loaded
        ? {
            ...current.links,
            items: [
              accepted,
              ...current.links.items.filter(
                (item) => item.username !== target,
              ),
            ],
          }
        : current.links,
    }));
    try {
      await decideLinkRequest(target, "approve");
      showToast("Link accepted.");
    } catch (cause) {
      setLists((current) => ({
        ...current,
        received: previousReceived,
        links: previousLinks,
      }));
      setError(getApiErrorMessage(cause, "The link could not be updated."));
    } finally {
      setPending("");
    }
  };

  const relationshipLabel = profile
    ? {
        self: "This is your account",
        linked: "You are linked",
        requested: "Link request sent",
        incoming: "This person sent you a link request",
        not_linked: profile.private ? "Private account" : "Public account",
        blocked: "You blocked this account",
      }[profile.relationship]
    : "";

  const showRequests = initialLoading || lists.received.items.length > 0;
  const showSent = !initialLoading && lists.sent.items.length > 0;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-7">
      <ConnectionsSearch
        error={searchError}
        loading={searching}
        onBlock={() => void toggleSearchBlock()}
        onRelationshipChange={() => void changeSearchRelationship()}
        onSearch={(event) => void findProfile(event)}
        onUsernameChange={setUsername}
        pending={pending}
        profile={profile}
        relationshipLabel={relationshipLabel}
        username={username}
      />

      {error && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-destructive" role="alert">{error}</p>
          <button
            className="text-sm underline underline-offset-4"
            onClick={() => void loadAll()}
            type="button"
          >
            Try again
          </button>
        </div>
      )}

      <div className="space-y-7">
        {showRequests && (
          <SocialListSection
            count={lists.received.count ?? lists.received.items.length}
            items={lists.received.items}
            kind="received"
            loading={initialLoading}
            loadingMore={loadingMore.received}
            nextCursor={lists.received.nextCursor}
            onDecide={(target, action) => void decideRequest(target, action)}
            onLoadMore={() => void loadMore("received")}
            pending={pending}
            title="Requests"
          />
        )}

        <SocialListSection
          count={lists.links.nextCursor ? undefined : lists.links.items.length}
          items={lists.links.items}
          kind="links"
          loading={initialLoading}
          loadingMore={loadingMore.links}
          nextCursor={lists.links.nextCursor}
          onBlock={(target) => void blockUser(target)}
          onLoadMore={() => void loadMore("links")}
          onUnlink={(target) =>
            void removeOptimistically(
              "links",
              target,
              () => removeLink(target),
              "Link removed.",
            )
          }
          pending={pending}
          title="Your links"
        />

        {showSent && (
          <SocialListSection
            count={lists.sent.nextCursor ? undefined : lists.sent.items.length}
            items={lists.sent.items}
            kind="sent"
            loading={false}
            loadingMore={loadingMore.sent}
            nextCursor={lists.sent.nextCursor}
            onCancelRequest={(target) =>
              void removeOptimistically(
                "sent",
                target,
                () => removeLink(target),
                "Link request cancelled.",
              )
            }
            onLoadMore={() => void loadMore("sent")}
            pending={pending}
            title="Waiting for acceptance"
          />
        )}
      </div>

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
