export function canViewInstant(
  isPrivate: boolean,
  isOwner: boolean,
  isFollowing: boolean,
  isBlocked: boolean,
): boolean {
  return !isBlocked && (isOwner || !isPrivate || isFollowing);
}
