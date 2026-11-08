"use client";

import {
  Images,
  ImagePlus,
  UserRound,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/connections", label: "Links", icon: UsersRound },
  { href: "/create", label: "Create", icon: ImagePlus },
  { href: "/", label: "Feed", icon: Images },
  { href: "/profile", label: "Profile", icon: UserRound },
] as const;

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-background/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_14px_rgba(0,0,0,0.07)] backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto grid h-12 max-w-md grid-cols-4">
        {items.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <li className="min-w-0" key={item.href}>
              <Link
                aria-current={isActive ? "page" : undefined}
                aria-label={item.label}
                className="group relative flex h-full items-center justify-center outline-none transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                href={item.href}
                title={item.label}
              >
                <Icon
                  aria-hidden="true"
                  className={`size-5 transition-colors ${
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground group-hover:text-foreground"
                  }`}
                  strokeWidth={isActive ? 2.1 : 1.6}
                />
                <span
                  aria-hidden="true"
                  className={`absolute bottom-1 size-1 rounded-full bg-foreground transition-opacity ${
                    isActive ? "opacity-100" : "opacity-0"
                  }`}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
