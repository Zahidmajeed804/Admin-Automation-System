// Shared hours<->minutes helpers. Hours stay stored as decimals everywhere
// (no DB migration); these only change how a decimal is rounded/displayed so
// that e.g. 20 minutes (0.333... hours) round-trips to exactly "20m" instead
// of being truncated by a 2-decimal round.

/** Rounds a decimal-hours value to the nearest minute, keeping it as decimal hours. */
export function roundToMinute(hours) {
  return Math.round(hours * 60) / 60;
}

/** Decimal hours -> "Xh Ym" (e.g. 12.5 -> "12h 30m"); negative values keep their sign out front. */
export function formatHoursMinutes(decimalHours) {
  if (decimalHours === undefined || decimalHours === null || Number.isNaN(Number(decimalHours))) return null;
  const value = Number(decimalHours);
  const sign = value < 0 ? "-" : "";
  const totalMinutes = Math.round(Math.abs(value) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${sign}${h}h ${m}m`;
}
