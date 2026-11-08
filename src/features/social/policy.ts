export function canViewProfileDetails(
  isPrivate: boolean,
  isSelf: boolean,
  isLinked: boolean,
): boolean {
  return !isPrivate || isSelf || isLinked;
}
