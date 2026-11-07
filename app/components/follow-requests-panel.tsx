"use client";

import { LoaderCircle, RefreshCw, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FollowRequest } from "@/src/features/social/client-api";

export function FollowRequestsPanel({
  requests,
  loading,
  error,
  pending,
  onRetry,
  onDecide,
}: {
  requests: FollowRequest[];
  loading: boolean;
  error: string;
  pending: string;
  onRetry: () => void;
  onDecide: (username: string, action: "approve" | "reject") => void;
}) {
  return (
    <section aria-labelledby="requests-title" className="max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold" id="requests-title">
            Follow requests
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Approve people to let them see your private Instants.
          </p>
        </div>
        <span className="grid min-w-7 place-items-center rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
          {requests.length}
        </span>
      </div>
      <div className="mt-4 rounded-xl bg-muted/35 px-4">
        {loading ? (
          <p className="py-4 text-sm text-muted-foreground" role="status">
            Loading requests...
          </p>
        ) : error ? (
          <div className="flex flex-wrap items-center justify-between gap-3 py-3">
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
            <Button
              onClick={onRetry}
              size="sm"
              type="button"
              variant="ghost"
            >
              <RefreshCw aria-hidden="true" />
              Try again
            </Button>
          </div>
        ) : requests.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            No pending requests right now.
          </p>
        ) : (
          <ul className="m-0 list-none p-0">
            {requests.map((request) => (
              <li
                className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-border/60 py-3 last:border-0"
                key={request.username}
              >
                <span className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-full bg-background text-muted-foreground">
                    <UserRound aria-hidden="true" className="size-4" />
                  </span>
                  <strong className="text-sm font-medium">
                    @{request.username}
                  </strong>
                </span>
                <div className="flex gap-2">
                  <Button
                    disabled={pending === request.username}
                    onClick={() => onDecide(request.username, "approve")}
                    size="sm"
                    type="button"
                  >
                    {pending === request.username ? (
                      <LoaderCircle
                        aria-label="Updating request"
                        className="animate-spin"
                      />
                    ) : (
                      "Approve"
                    )}
                  </Button>
                  <Button
                    disabled={pending === request.username}
                    onClick={() => onDecide(request.username, "reject")}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
