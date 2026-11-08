export function canViewInstant(
  isPrivate: boolean,
  isOwner: boolean,
  isLinked: boolean,
  isBlocked: boolean,
): boolean {
  return !isBlocked && (isOwner || !isPrivate || isLinked);
}
