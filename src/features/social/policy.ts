export function canViewProfileDetails(
  isPrivate: boolean,
  isSelf: boolean,
  isFollowing: boolean,
): boolean {
  return !isPrivate || isSelf || isFollowing;
}
