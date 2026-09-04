/**
 * Whether an identity-portal record is active.
 *
 * <p>The portal stores status as a smallint and sends it as one — `1` is active. Comparing it
 * against `"ACTIVE"` is always false, which is not a crash and not an error: every row simply
 * renders as Inactive, and the screen looks like a correct answer about a broken estate rather
 * than a broken read of a healthy one. That is exactly how it shipped on the Users screen.
 *
 * <p>Both forms are accepted because the same records are read from two places — straight from
 * the portal, and from this service's own replica of them, where the column may have been
 * written as a word. Absent counts as active: the portal omits the field on records it has
 * never deactivated.
 */
export function isActiveStatus(
  status: string | number | null | undefined
): boolean {
  if (status === null || status === undefined) return true;
  if (typeof status === "number") return status === 1;
  const normalised = status.trim().toUpperCase();
  return normalised === "ACTIVE" || normalised === "1";
}
