/**
 * Formats an ISO date string for display (e.g. "Sep 23, 2026"). Returns
 * "—" for a missing date, matching how the rest of the app shows an
 * absent optional value.
 */
export function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Formats an ISO date string as "dd,mm yyyy" (e.g. "23,09 2026"), used for
 * the generator logs list where that compact numeric format is wanted
 * instead of formatDate's "Sep 23, 2026". Returns "—" for a missing date.
 */
export function formatDateNumeric(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())},${pad(d.getMonth() + 1)} ${d.getFullYear()}`;
}

/**
 * Today's local date as "YYYY-MM-DD", for defaulting a native
 * <input type="date">. Built from local getters (not toISOString, which is
 * UTC and can land on the wrong day near midnight).
 */
export function todayDateValue() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
