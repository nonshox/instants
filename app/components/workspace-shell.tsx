"use client";

import {
  ArrowLeft,
  Bell,
  LogOut,
  Menu as MenuIcon,
  Settings,
  UserRound,
} from "lucide-react";
import { Menu } from "@base-ui/react/menu";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { logout } from "@/src/features/auth/client-api";
import { fetchProfile, type Profile } from "@/src/features/profile/client-api";
import { useInstantStore } from "@/src/features/instants/store";
import { useNotificationStore } from "@/src/features/notifications/store";
import { getApiErrorMessage } from "@/src/lib/api-client";
import { UserAvatar } from "@/app/components/user-avatar";
import { MobileNav } from "@/app/components/mobile-nav";

const menuItems = [
  { label: "Profile", href: "/profile", icon: UserRound },
  { label: "Settings", href: "/settings", icon: Settings },
];

const desktopNavItems = [
  { label: "Links", href: "/connections" },
  { label: "Create", href: "/create" },
  { label: "Feed", href: "/" },
];

function isNavActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function WorkspaceShell({
  accountId,
  children,
}: {
  accountId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const loadNotifications = useNotificationStore((state) => state.load);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    let active = true;
    fetchProfile()
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch(() => {
        // The header falls back to the symbol icon when the profile fails to load.
      });
    return () => {
      active = false;
    };
  }, [pathname]);

  const signOut = async () => {
    setSigningOut(true);
    setError("");
    try {
      await logout();
      useInstantStore.getState().reset();
      useNotificationStore.getState().reset();
      router.replace("/auth");
    } catch (cause) {
      setError(
        getApiErrorMessage(
          cause,
          "We could not end this session. Please try again.",
        ),
      );
      setSigningOut(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="relative mx-auto flex min-h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Button
              aria-label="Go back"
              onClick={() => {
                if (window.history.length > 1) {
                  router.back();
                } else {
                  router.push("/");
                }
              }}
              size="icon"
              type="button"
              variant="ghost"
            >
              <ArrowLeft aria-hidden="true" />
            </Button>
            <Link
              className="inline-flex items-center gap-2 font-semibold tracking-tight text-foreground"
              href="/"
            >
              <Image
                alt=""
                aria-hidden="true"
                className="size-8 rounded-md object-cover border-2 border-black/40"
                height={50}
                src="/logotype/logotype.png"
                width={50}
              />
              <span>Mono</span>
            </Link>
          </div>
          <nav
            aria-label="Primary"
            className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 rounded-full border border-border/60 bg-muted/40 p-1 md:flex"
          >
            {desktopNavItems.map((item) => {
              const isCurrent = isNavActive(pathname, item.href);
              return (
                <Link
                  aria-current={isCurrent ? "page" : undefined}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-ring ${
                    isCurrent
                      ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              aria-label={
                unreadCount > 0
                  ? `Notifications, ${unreadCount} unread`
                  : "Notifications"
              }
              className="relative grid size-10 place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              href="/notifications"
            >
              <Bell aria-hidden="true" className="size-5" strokeWidth={1.8} />
              {unreadCount > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-semibold leading-4 text-white ring-2 ring-background"
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
            <Menu.Root onOpenChange={setMenuOpen} open={menuOpen}>
            <Menu.Trigger
              aria-label="Open menu"
              render={
                <button
                  aria-label="Open menu"
                  className="rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                  type="button"
                >
                  {profile ? (
                    <UserAvatar
                      avatar={profile.avatar}
                      size={30}
                      userId={accountId}
                      username={profile.username}
                    />
                  ) : (
                    <span className="grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground">
                      <MenuIcon aria-hidden="true" className="size-5" />
                    </span>
                  )}
                </button>
              }
            />
            <Menu.Portal>
              {/* Floating UI anchors the positioner with a transform, which caps its children's stacking — give the positioner itself the z-index */}
              <Menu.Positioner align="end" className="z-[100]" sideOffset={6}>
                <Menu.Popup className="z-[100] min-w-40 rounded-lg bg-popover p-1 text-popover-foreground shadow-lg shadow-black/10 ring-1 ring-foreground/5 outline-none sm:min-w-52 sm:rounded-xl sm:p-1.5">
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isCurrent = pathname === item.href;
                    return (
                      <Menu.LinkItem
                        aria-current={isCurrent ? "page" : undefined}
                        className={`flex h-8 items-center gap-2 rounded-md px-2 text-[13px] outline-none transition-colors focus:bg-muted sm:h-9 sm:text-sm ${
                          isCurrent
                            ? "bg-muted font-medium text-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                        key={item.href}
                        onClick={() => setMenuOpen(false)}
                        render={<Link href={item.href} />}
                      >
                        <Icon aria-hidden="true" className="size-4" />
                        {item.label}
                      </Menu.LinkItem>
                    );
                  })}
                  <Menu.Separator className="my-1 h-px bg-border/70" />
                  <Menu.Item
                    className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-[13px] text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus:bg-muted disabled:pointer-events-none disabled:opacity-50 sm:h-9 sm:text-sm"
                    disabled={signingOut}
                    onClick={() => void signOut()}
                  >
                    <LogOut aria-hidden="true" className="size-4" />
                    {signingOut ? "Signing out..." : "Sign out"}
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
            </Menu.Root>
          </div>
        </div>
      </header>
      {error && (
        <p className="mx-auto max-w-5xl px-4 pt-3 text-sm text-destructive sm:px-6" role="alert">
          {error}
        </p>
      )}
      <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-16 sm:px-6 sm:pt-8 md:pb-10">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}

export function SessionExpired() {
  return (
    <section className="grid gap-3 rounded-lg border p-5" role="status">
      <div>
        <h1 className="text-lg font-semibold">Session expired</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in again to continue to your workspace.
        </p>
      </div>
      <Link
        className="text-sm font-medium underline underline-offset-4"
        href="/auth"
      >
        Return to sign in
      </Link>
    </section>
  );
}
