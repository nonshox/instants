"use client";

import {
  ArrowLeft,
  Bell,
  Images,
  ImagePlus,
  LogOut,
  Menu as MenuIcon,
  Settings,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Menu } from "@base-ui/react/menu";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { logout } from "@/src/features/auth/client-api";
import { useInstantStore } from "@/src/features/instants/store";
import { useNotificationStore } from "@/src/features/notifications/store";
import { getApiErrorMessage } from "@/src/lib/api-client";

const navigationGroups = [
  [
    { label: "Following", href: "/", icon: Images },
    { label: "Create an Instant", href: "/create", icon: ImagePlus },
    { label: "Connections", href: "/connections", icon: UsersRound },
    { label: "Notifications", href: "/notifications", icon: Bell },
  ],
  [
    { label: "Profile", href: "/profile", icon: UserRound },
    { label: "Settings", href: "/settings", icon: Settings },
  ],
];

export function WorkspaceShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");

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
      <header className="border-b border-border">
        <div className="mx-auto flex min-h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
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
          <Menu.Root onOpenChange={setMenuOpen} open={menuOpen}>
            <Menu.Trigger
              aria-label="Open menu"
              render={
                <Button aria-label="Open menu" size="icon" variant="ghost">
                  <MenuIcon aria-hidden="true" />
                </Button>
              }
            />
            <Menu.Portal>
              <Menu.Positioner align="end" sideOffset={6}>
                <Menu.Popup className="z-50 min-w-52 rounded-xl bg-popover p-1.5 text-popover-foreground shadow-lg shadow-black/10 ring-1 ring-foreground/5 outline-none">
                  {navigationGroups.map((group, groupIndex) => (
                    <Fragment key={group[0].href}>
                      {groupIndex > 0 && (
                        <Menu.Separator className="my-1 h-px bg-border/70" />
                      )}
                      {group.map((item) => {
                        const Icon = item.icon;
                        const isCurrent = pathname === item.href;
                        return (
                          <Menu.LinkItem
                            aria-current={isCurrent ? "page" : undefined}
                            className={`flex h-9 items-center gap-2 rounded-md px-2 text-sm outline-none transition-colors focus:bg-muted ${
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
                    </Fragment>
                  ))}
                  <Menu.Separator className="my-1 h-px bg-border/70" />
                  <Menu.Item
                    className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus:bg-muted disabled:pointer-events-none disabled:opacity-50"
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
      </header>
      {error && (
        <p className="mx-auto max-w-5xl px-4 pt-3 text-sm text-destructive sm:px-6" role="alert">
          {error}
        </p>
      )}
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
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
