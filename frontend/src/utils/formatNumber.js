/**
 * Formats a number for display with thousands separators and at most 2
 * decimals (e.g. 14275 -> "14,275", 285.5 -> "285.5"). Returns "—" for a
 * missing value, matching how the rest of the app shows an absent one.
 */
export function formatNumber(value) {
  if (value === undefined || value === null || value === "") return "—";
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}
