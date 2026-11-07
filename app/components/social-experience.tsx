"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ConnectionsSearch } from "@/app/components/connections-search";
import { FollowRequestsPanel } from "@/app/components/follow-requests-panel";
import {
  decideFollowRequest,
  fetchFollowRequests,
  searchSocialProfile,
  updateBlock,
  updateRelationship as updateRelationshipRequest,
  type FollowRequest,
  type SocialProfile,
} from "@/src/features/social/client-api";
import { getApiErrorMessage } from "@/src/lib/api-client";

export function SocialExperience() {
  const [username, setUsername] = useState("");
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [searching, setSearching] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState("");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchFollowRequests()
      .then((data) => {
        if (active) {
          setRequests(data);
          setRequestsError("");
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setRequestsError(
            getApiErrorMessage(cause, "We could not load follow requests."),
          );
        }
      })
      .finally(() => {
        if (active) setRequestsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const reloadRequests = async () => {
    setRequestsLoading(true);
    setRequestsError("");
    try {
      setRequests(await fetchFollowRequests());
    } catch (cause) {
      setRequestsError(
        getApiErrorMessage(cause, "We could not load follow requests."),
      );
    } finally {
      setRequestsLoading(false);
    }
  };

  const findProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearching(true);
    setProfile(null);
    setError("");

    try {
      setProfile(await searchSocialProfile(username.trim()));
    } catch (cause) {
      setError(getApiErrorMessage(cause, "We could not find that account."));
    } finally {
      setSearching(false);
    }
  };

  const updateRelationship = async () => {
    if (!profile) return;
    const target = profile.username;
    setPending(target);
    setError("");

    try {
      if (
        profile.relationship === "following" ||
        profile.relationship === "requested"
      ) {
        await updateRelationshipRequest(target, true);
        setProfile({ ...profile, relationship: "not_following" });
      } else {
        const relationship = await updateRelationshipRequest(target, false);
        if (relationship) setProfile({ ...profile, relationship });
      }
    } catch (cause) {
      const actionError = getApiErrorMessage(
        cause,
        "We could not update that relationship.",
      );
      setError(actionError);
      try {
        setProfile(await searchSocialProfile(target));
      } catch (refreshCause) {
        setError(
          `${actionError} ${getApiErrorMessage(
            refreshCause,
            "The relationship status could not be refreshed.",
          )}`,
        );
      }
    } finally {
      setPending("");
    }
  };

  const decideRequest = async (
    requester: string,
    action: "approve" | "reject",
  ) => {
    setPending(requester);
    setError("");

    try {
      await decideFollowRequest(requester, action);
      setRequests((current) =>
        current.filter((request) => request.username !== requester),
      );
      setProfile((current) =>
        current?.username === requester
          ? { ...current, relationship: "not_following" }
          : current,
      );
    } catch (cause) {
      setError(
        getApiErrorMessage(cause, "We could not update that request."),
      );
    } finally {
      setPending("");
    }
  };

  const toggleBlock = async () => {
    if (!profile) return;
    const target = profile.username;
    const isBlocked = profile.relationship === "blocked";
    if (!isBlocked && !window.confirm(`Block @${target}?`)) return;

    setPending(target);
    setError("");
    try {
      if (isBlocked) {
        const updatedProfile = await updateBlock(target, true);
        if (updatedProfile) setProfile(updatedProfile);
      } else {
        await updateBlock(target, false);
        setProfile({ ...profile, relationship: "blocked", name: "" });
        setRequests((current) =>
          current.filter((request) => request.username !== target),
        );
      }
    } catch (cause) {
      setError(getApiErrorMessage(cause, "We could not update that block."));
    } finally {
      setPending("");
    }
  };

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
    <div className="space-y-8">
      <header>
        <p className="mb-1 text-sm text-muted-foreground">Your circle</p>
        <h1 className="text-2xl font-semibold tracking-tight">Connections</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Find people and manage who can follow you.
        </p>
      </header>
      <ConnectionsSearch
        error={error}
        loading={searching}
        onBlock={() => void toggleBlock()}
        onRelationshipChange={() => void updateRelationship()}
        onSearch={(event) => void findProfile(event)}
        onUsernameChange={setUsername}
        pending={pending}
        profile={profile}
        relationshipLabel={relationshipLabel}
        username={username}
      />
      <FollowRequestsPanel
        error={requestsError}
        loading={requestsLoading}
        onDecide={(requester, action) =>
          void decideRequest(requester, action)
        }
        onRetry={() => void reloadRequests()}
        pending={pending}
        requests={requests}
      />
    </div>
  );
}
