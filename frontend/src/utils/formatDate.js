/**
 * Formats an ISO date string for display (e.g. "Sep 23, 2026"). Returns
 * "—" for a missing date, matching how the rest of the app shows an
 * absent optional value.
 */
export function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
