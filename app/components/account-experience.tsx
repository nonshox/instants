"use client";

import { MonitorSmartphone, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IntegrationExperience } from "@/app/components/integration-experience";
import { LocalDateTime } from "@/app/components/local-date-time";
import {
  fetchSessions,
  revokeSession,
  type AuthSession,
} from "@/src/features/auth/client-api";

export function AccountExperience({
  email,
  initialSessions,
}: {
  email: string;
  initialSessions: AuthSession[];
}) {
  const router = useRouter();
  const [sessions, setSessions] = useState(initialSessions);
  const [pendingId, setPendingId] = useState("");
  const [error, setError] = useState("");

  const loadSessions = async () => {
    setError("");
    try {
      setSessions(await fetchSessions());
    } catch {
      setError("We could not load active sessions.");
    }
  };

  const revokeSessionForAccount = async (session: AuthSession) => {
    setPendingId(session.id);
    setError("");
    try {
      await revokeSession(session.id);
      if (session.current) {
        router.refresh();
        return;
      }
      await loadSessions();
    } catch {
      setError("We could not revoke that session. Please try again.");
    } finally {
      setPendingId("");
    }
  };

  return (
    <div>
      <header className="mb-6">
        <p className="text-sm text-muted-foreground">{email}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Settings</h1>
      </header>
      <IntegrationExperience />

      <section className="mt-8" aria-labelledby="sessions-title">
        <div className="border-b border-border pb-4">
          <h2 className="text-xl font-semibold tracking-tight" id="sessions-title">
            Active sessions
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Access to your account across devices.
          </p>
        </div>
        {error && (
          <p className="my-1 text-xs leading-5 text-destructive" role="alert">
            {error}
          </p>
        )}
        {sessions.length === 0 ? (
          <p className="py-5 text-sm text-muted-foreground">
            No active sessions found.
          </p>
        ) : (
          <ul className="m-0 list-none p-0">
            {sessions.map((session) => (
              <li
                className="flex min-h-16 items-center gap-3 border-b border-border"
                key={session.id}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                  <MonitorSmartphone aria-hidden="true" size={18} />
                </span>
                <div className="flex-1">
                  <p className="m-0 flex items-center gap-2 text-sm font-medium">
                    {session.device}
                    {session.current && (
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        This device
                      </span>
                    )}
                  </p>
                  <p className="mb-0 mt-1 text-xs text-muted-foreground">
                    {session.operatingSystem && (
                      <>
                        {session.operatingSystem} ·{" "}
                      </>
                    )}
                    <LocalDateTime value={session.createdAt} />
                  </p>
                </div>
                {!session.current && (
                  <Button
                    aria-label={`Revoke ${session.device} session`}
                    className="text-muted-foreground"
                    disabled={pendingId === session.id}
                    onClick={() => void revokeSessionForAccount(session)}
                    size="icon"
                    type="button"
                    variant="outline"
                  >
                    <X aria-hidden="true" size={17} />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <Button
          className="mt-3"
          onClick={() => void loadSessions()}
          type="button"
          variant="ghost"
        >
          Refresh sessions
        </Button>
      </section>
    </div>
  );
}
