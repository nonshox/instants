"use client";

import {
  Ban,
  ChevronRight,
  LoaderCircle,
  Mail,
  MonitorSmartphone,
  RefreshCw,
  Send,
  ShieldCheck,
  Unlink,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { LocalDateTime } from "@/app/components/local-date-time";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/app/components/user-avatar";
import {
  createTelegramLink,
  disconnectTelegram,
  fetchTelegramStatus,
} from "@/src/features/telegram/client-api";
import {
  fetchSessions,
  revokeSession,
  type AuthSession,
} from "@/src/features/auth/client-api";
import {
  fetchProfile,
  saveProfile,
  type Profile,
} from "@/src/features/profile/client-api";
import {
  fetchBlockedAccounts,
  updateBlock,
  type ConnectionItem,
  type ConnectionPage,
} from "@/src/features/social/client-api";
import { getApiErrorMessage } from "@/src/lib/api-client";
import Link from "next/link";
import { useRouter } from "next/navigation";

type BlockedState = ConnectionPage & { loaded: boolean };

export function SettingsExperience({
  email,
  initialSessions,
}: {
  email: string;
  initialSessions: AuthSession[];
}) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [loadingTelegram, setLoadingTelegram] = useState(true);
  const [telegramPending, setTelegramPending] = useState(false);
  const [telegramLink, setTelegramLink] = useState("");
  const [sessions, setSessions] = useState(initialSessions);
  const [pendingSession, setPendingSession] = useState("");
  const [refreshingSessions, setRefreshingSessions] = useState(false);
  const [blocked, setBlocked] = useState<BlockedState>({
    items: [],
    nextCursor: null,
    loaded: false,
  });
  const [pendingBlock, setPendingBlock] = useState("");
  const [loadingBlocked, setLoadingBlocked] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    fetchProfile()
      .then((value) => {
        if (active) setProfile(value);
      })
      .catch(() => {
        if (active) {
          setError("Privacy settings could not be loaded.");
        }
      })
      .finally(() => {
        if (active) setLoadingProfile(false);
      });

    fetchTelegramStatus()
      .then((isConnected) => {
        if (active) setTelegramConnected(isConnected);
      })
      .catch(() => {
        if (active) setError("Telegram status could not be checked.");
      })
      .finally(() => {
        if (active) setLoadingTelegram(false);
      });

    fetchBlockedAccounts()
      .then((page) => {
        if (active) setBlocked({ ...page, loaded: true });
      })
      .catch(() => {
        if (active) setError("Blocked accounts could not be loaded.");
      })
      .finally(() => {
        if (active) setLoadingBlocked(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const togglePrivacy = async () => {
    if (!profile || savingPrivacy) return;
    const previous = profile;
    setSavingPrivacy(true);
    setError("");
    setMessage("");
    const next = { ...profile, private: !profile.private };
    setProfile(next);
    try {
      setProfile(
        await saveProfile(
          {
            username: next.username,
            name: next.name,
            bio: next.bio,
            private: next.private,
          },
          true,
        ),
      );
      setMessage(next.private ? "Your account is now private." : "Your account is now public.");
    } catch (cause) {
      setProfile(previous);
      setError(
        getApiErrorMessage(cause, "Privacy settings could not be saved."),
      );
    } finally {
      setSavingPrivacy(false);
    }
  };

  const toggleTelegram = async () => {
    if (telegramPending) return;
    setTelegramPending(true);
    setError("");
    setMessage("");
    try {
      if (telegramConnected) {
        await disconnectTelegram();
        setTelegramConnected(false);
        setTelegramLink("");
        setMessage("Telegram disconnected.");
        return;
      }
      setTelegramLink(await createTelegramLink());
    } catch (cause) {
      setError(
        getApiErrorMessage(cause, "Telegram could not be updated."),
      );
    } finally {
      setTelegramPending(false);
    }
  };

  const refreshTelegram = async () => {
    if (telegramPending) return;
    setTelegramPending(true);
    setError("");
    try {
      const isConnected = await fetchTelegramStatus();
      setTelegramConnected(isConnected);
      if (isConnected) setTelegramLink("");
      setMessage(isConnected ? "Telegram is connected." : "Not connected yet — finish linking in Telegram first.");
    } catch {
      setError("Telegram status could not be checked.");
    } finally {
      setTelegramPending(false);
    }
  };

  const refreshSessions = async () => {
    if (refreshingSessions) return;
    setRefreshingSessions(true);
    setError("");
    try {
      setSessions(await fetchSessions());
    } catch {
      setError("Active sessions could not be loaded.");
    } finally {
      setRefreshingSessions(false);
    }
  };

  const revokeSessionForAccount = async (session: AuthSession) => {
    if (pendingSession) return;
    setPendingSession(session.id);
    setError("");
    try {
      await revokeSession(session.id);
      if (session.current) {
        router.refresh();
        return;
      }
      await refreshSessions();
      setMessage("Session revoked.");
    } catch {
      setError("We could not revoke that session. Please try again.");
    } finally {
      setPendingSession("");
    }
  };

  const loadBlockedMore = async () => {
    if (!blocked.nextCursor || loadingBlocked) return;
    setLoadingBlocked(true);
    setError("");
    try {
      const page = await fetchBlockedAccounts(blocked.nextCursor);
      setBlocked((current) => ({
        items: [...current.items, ...page.items],
        nextCursor: page.nextCursor,
        loaded: true,
      }));
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Blocked accounts could not be loaded."));
    } finally {
      setLoadingBlocked(false);
    }
  };

  const unblock = async (item: ConnectionItem) => {
    if (pendingBlock) return;
    setPendingBlock(item.username);
    setError("");
    setBlocked((current) => ({
      ...current,
      items: current.items.filter((entry) => entry.username !== item.username),
    }));
    try {
      await updateBlock(item.username, true);
      setMessage(`@${item.username} unblocked. Links were not restored.`);
    } catch (cause) {
      setError(getApiErrorMessage(cause, "The account could not be unblocked."));
      try {
        const page = await fetchBlockedAccounts();
        setBlocked({ ...page, loaded: true });
      } catch {
        // Keep the current list; the error message already tells the user it failed.
      }
    } finally {
      setPendingBlock("");
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {email}
        </p>
      </header>

      <Section title="Account">
        <Row
          icon={Mail}
          title="Email"
          description={email}
        />
      </Section>

      <Section title="Notifications">
        <Row
          icon={Send}
          title="Telegram"
          description={
            loadingTelegram
              ? "Checking connection..."
              : telegramConnected
                ? "Connected — you get a private message when something happens."
                : "Not connected"
          }
          action={
            <Button
              disabled={telegramPending || loadingTelegram}
              onClick={() => void toggleTelegram()}
              size="sm"
              type="button"
              variant={telegramConnected ? "outline" : "default"}
            >
              {telegramPending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : telegramConnected ? (
                <>
                  <Unlink aria-hidden="true" />
                  Disconnect
                </>
              ) : (
                "Connect"
              )}
            </Button>
          }
        />
        {telegramLink && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/30 px-4 py-3 sm:px-5">
            <a
              className="inline-flex items-center gap-1 text-xs font-medium underline underline-offset-4"
              href={telegramLink}
              rel="noreferrer"
              target="_blank"
            >
              Open Telegram to finish linking
              <ChevronRight aria-hidden="true" className="size-3.5" />
            </a>
            <Button
              className="text-muted-foreground"
              disabled={telegramPending}
              onClick={() => void refreshTelegram()}
              size="xs"
              type="button"
              variant="ghost"
            >
              Check connection
            </Button>
          </div>
        )}
      </Section>

      <Section title="Privacy">
        <Row
          icon={ShieldCheck}
          title="Private account"
          description={
            loadingProfile
              ? "Loading..."
              : profile?.private
                ? "Link requests need your acceptance before your Instants are visible."
                : "Anyone can send you a link request."
          }
          action={
            !profile && !loadingProfile ? (
              <Link
                className="text-xs font-medium underline underline-offset-4"
                href="/profile"
              >
                Create profile
              </Link>
            ) : (
              <Switch
                checked={Boolean(profile?.private)}
                disabled={savingPrivacy || loadingProfile || !profile}
                label="Toggle private account"
                onToggle={() => void togglePrivacy()}
              />
            )
          }
        />
        <Row
          icon={Ban}
          title="Blocked accounts"
          description="Unblocking never restores links or requests."
        />
        {loadingBlocked && blocked.items.length === 0 ? (
          <p className="px-4 py-3 text-xs text-muted-foreground" role="status">
            Loading...
          </p>
        ) : blocked.items.length === 0 ? (
          <p className="px-4 py-3 text-xs text-muted-foreground">
            No blocked accounts.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {blocked.items.map((item) => (
              <li className="flex items-center gap-3 py-2.5 pl-[3.25rem] pr-4 sm:pl-[3.75rem] sm:pr-5" key={item.username}>
                <Link
                  aria-label={`Open @${item.username}'s profile`}
                  className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  href={`/u/${encodeURIComponent(item.username)}`}
                >
                  <UserAvatar
                    avatar={item.avatar}
                    name={item.name}
                    size={32}
                    userId={item.id}
                    username={item.username}
                  />
                </Link>
                <Link
                  className="min-w-0 flex-1 truncate text-xs font-medium hover:underline"
                  href={`/u/${encodeURIComponent(item.username)}`}
                >
                  {item.name || `@${item.username}`}
                </Link>
                <Button
                  disabled={pendingBlock === item.username}
                  onClick={() => void unblock(item)}
                  size="xs"
                  type="button"
                  variant="outline"
                >
                  {pendingBlock === item.username ? "Unblocking..." : "Unblock"}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {blocked.nextCursor && (
          <div className="bg-muted/30 px-4 py-2 sm:px-5">
            <Button
              className="text-muted-foreground"
              disabled={loadingBlocked}
              onClick={() => void loadBlockedMore()}
              size="xs"
              type="button"
              variant="ghost"
            >
              {loadingBlocked ? "Loading..." : "Load more"}
            </Button>
          </div>
        )}
      </Section>

      <Section
        action={
          <button
            aria-label="Refresh sessions"
            className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            disabled={refreshingSessions}
            onClick={() => void refreshSessions()}
            type="button"
          >
                <RefreshCw
                  aria-hidden="true"
                  className={`size-4 ${refreshingSessions ? "animate-spin" : ""}`}
                />
          </button>
        }
        title="Sessions"
      >
        {sessions.length === 0 ? (
          <p className="px-4 py-4 text-xs text-muted-foreground">
            No active sessions.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {sessions.map((session) => (
              <li className="flex items-center gap-3 px-4 py-3 sm:px-5" key={session.id}>
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <MonitorSmartphone aria-hidden="true" className="size-4" strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-xs font-medium leading-5">
                    <span className="truncate">{session.device}</span>
                    {session.current && (
                      <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                        This device
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                    {session.operatingSystem ? `${session.operatingSystem} · ` : ""}
                    <LocalDateTime value={session.createdAt} />
                  </p>
                </div>
                {!session.current && (
                  <button
                    aria-label={`Revoke ${session.device} session`}
                    className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                    disabled={pendingSession === session.id}
                    onClick={() => void revokeSessionForAccount(session)}
                    type="button"
                  >
                    {pendingSession === session.id ? (
                      <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                    ) : (
                      <X aria-hidden="true" className="size-4" />
                    )}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {(error || message) && (
        <p
          className={`mt-4 px-1 text-xs leading-5 ${error ? "text-destructive" : "text-muted-foreground"}`}
          role={error ? "alert" : "status"}
        >
          {error || message}
        </p>
      )}
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="mt-6 first:mt-0">
      <div className="mb-1.5 flex items-center justify-between gap-3 px-1">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </h2>
        {action}
      </div>
      <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        {children}
      </div>
    </section>
  );
}

function Row({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof Mail;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground sm:size-9">
        <Icon aria-hidden="true" className="size-4" strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold leading-5">{title}</p>
        {description && (
          <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function Switch({
  checked,
  disabled,
  label,
  onToggle,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className={`relative h-6 w-11 shrink-0 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 ${
        checked ? "bg-foreground" : "bg-muted-foreground/30"
      }`}
      disabled={disabled}
      onClick={onToggle}
      role="switch"
      type="button"
    >
      <span
        aria-hidden="true"
        className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-background shadow-sm transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}


