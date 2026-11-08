import Image from "next/image";

type UserAvatarProps = {
  userId?: string;
  username?: string;
  name?: string;
  avatar?: string;
  size?: number;
  className?: string;
};

/**
 * Compact initials-or-photo avatar. Avatar images are served through the
 * authorized /api/avatars/[userId] route; anything else falls back to initials.
 */
export function UserAvatar({
  userId,
  username = "",
  name,
  avatar,
  size = 40,
  className,
}: UserAvatarProps) {
  const dimension = `${size}px`;
  const base = `shrink-0 rounded-full object-cover ring-1 ring-border/60 ${className ?? ""}`;

  if (userId && avatar) {
    // The avatar file ID changes on every upload, so including it busts caches.
    const src = `/api/avatars/${encodeURIComponent(userId)}?v=${encodeURIComponent(avatar)}`;
    return (
      <Image
        alt={name ? `${name}'s avatar` : `@${username}'s avatar`}
        className={base}
        height={size}
        src={src}
        style={{ height: dimension, width: dimension }}
        unoptimized
        width={size}
      />
    );
  }

  const initial = (name?.trim() || username.trim() || "?")
    .charAt(0)
    .toUpperCase();

  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full bg-muted font-semibold text-muted-foreground ${className ?? ""}`}
      style={{ height: dimension, width: dimension, fontSize: size * 0.36 }}
    >
      {initial}
    </span>
  );
}
