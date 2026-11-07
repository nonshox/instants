"use client";

import { Ban, Search, UserRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchFollowRequests()
      .then((data) => {
        if (active) {
          setRequests(data);
        }
      })
      .catch(() => {
        if (active) {
          setError("We could not load follow requests.");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const findProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setProfile(null);
    setError("");

    try {
      setProfile(await searchSocialProfile(username.trim()));
    } catch (cause) {
      setError(
        getApiErrorMessage(cause, "We could not find that account."),
      );
    } finally {
      setLoading(false);
    }
  };

  const updateRelationship = async () => {
    if (!profile) {
      return;
    }
    const target = profile.username;
    setPending(target);
    setError("");

    try {
      if (profile.relationship === "following" || profile.relationship === "requested") {
        await updateRelationshipRequest(target, true);
        setProfile({ ...profile, relationship: "not_following" });
      } else {
        const relationship = await updateRelationshipRequest(target, false);
        if (relationship) {
          setProfile({ ...profile, relationship });
        }
      }
    } catch (cause) {
      setError(
        getApiErrorMessage(cause, "We could not update that relationship."),
      );
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
    if (!profile) {
      return;
    }
    const target = profile.username;
    const isBlocked = profile.relationship === "blocked";
    if (!isBlocked && !window.confirm(`Block @${target}?`)) {
      return;
    }

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
    <Card
      aria-labelledby="social-title"
      className="mt-6 scroll-mt-6 gap-0 py-0 shadow-none"
      id="social"
    >
      <CardHeader className="flex flex-row items-center justify-between border-b px-5 py-4">
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Connections
          </p>
          <CardTitle className="text-xl font-semibold tracking-tight" id="social-title">
            Find your people
          </CardTitle>
        </div>
        <UserRound aria-hidden="true" className="text-muted-foreground" size={20} />
      </CardHeader>

      <CardContent className="px-5 py-4">
        <form className="grid gap-2" onSubmit={findProfile}>
          <Label htmlFor="social-username">Find an account by username</Label>
          <div className="flex items-center gap-2">
            <Input
              autoComplete="off"
              id="social-username"
              maxLength={30}
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Username"
            />
            <Button
              aria-label="Search accounts"
              className="shrink-0"
              disabled={loading || !username.trim()}
              type="submit"
            >
              <Search aria-hidden="true" size={16} />
              {loading ? "Searching..." : "Search"}
            </Button>
          </div>
        </form>

        {error && (
          <p className="my-3 text-xs leading-5 text-destructive" role="alert">
            {error}
          </p>
        )}

        {profile && (
          <article className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted p-3.5">
            <div className="grid gap-1 text-[11px] text-muted-foreground">
              <strong className="text-sm font-medium text-foreground">
                @{profile.username}
              </strong>
              {profile.name && <span>{profile.name}</span>}
              {profile.bio && <span>{profile.bio}</span>}
              <span>{relationshipLabel}</span>
            </div>
            {profile.relationship !== "self" && (
              <div className="flex flex-wrap justify-end gap-2">
                {profile.relationship !== "blocked" &&
                  profile.relationship !== "incoming" && (
                    <Button
                      disabled={pending === profile.username}
                      onClick={updateRelationship}
                      type="button"
                      variant="outline"
                    >
                      {pending === profile.username
                        ? "Updating..."
                        : profile.relationship === "following"
                          ? "Unfollow"
                          : profile.relationship === "requested"
                            ? "Cancel request"
                            : profile.private
                              ? "Request to follow"
                              : "Follow"}
                    </Button>
                  )}
                <Button
                  aria-label={
                    profile.relationship === "blocked"
                      ? `Unblock ${profile.username}`
                      : `Block ${profile.username}`
                  }
                  className="text-destructive"
                  disabled={pending === profile.username}
                  onClick={toggleBlock}
                  type="button"
                  variant="outline"
                >
                  <Ban aria-hidden="true" size={14} />
                  {profile.relationship === "blocked" ? "Unblock" : "Block"}
                </Button>
              </div>
            )}
          </article>
        )}

        <div className="mt-6">
          <div className="flex items-center justify-between border-b pb-2.5">
            <h3 className="m-0 text-sm font-semibold">
              Follow requests
            </h3>
            <span className="text-[11px] text-muted-foreground">
              {requests.length}
            </span>
          </div>
          {requests.length === 0 ? (
            <p className="py-3 text-xs text-muted-foreground">
              No pending requests.
            </p>
          ) : (
            <ul className="m-0 list-none p-0">
              {requests.map((request) => (
                <li
                  className="flex min-h-[60px] items-center justify-between gap-3 border-b max-[680px]:flex-wrap max-[680px]:py-3"
                  key={request.username}
                >
                  <strong className="text-sm font-medium">
                    @{request.username}
                  </strong>
                  <div className="flex gap-2">
                    <Button
                      disabled={pending === request.username}
                      onClick={() => decideRequest(request.username, "approve")}
                      type="button"
                    >
                      Approve
                    </Button>
                    <Button
                      disabled={pending === request.username}
                      onClick={() => decideRequest(request.username, "reject")}
                      type="button"
                      variant="outline"
                    >
                      Reject
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
