// Decimal hours <-> {h, m} for the Hours+Minutes input, and decimal hours ->
// "Xh Ym" for display. Storage stays decimal hours everywhere (no migration);
// these only change how a value is entered/rounded/shown, rounding to the
// nearest MINUTE (not 2 decimals) so e.g. 20 minutes (0.333... hours)
// round-trips to exactly "20m" instead of truncating to "0.33".

/** Decimal hours (number, numeric string, or "") -> { h, m } as strings ("" when blank). */
export function toHoursMinutes(decimalHours) {
  if (decimalHours === "" || decimalHours === null || decimalHours === undefined) return { h: "", m: "" };
  const value = Number(decimalHours);
  if (Number.isNaN(value)) return { h: "", m: "" };
  const sign = value < 0 ? -1 : 1;
  const totalMinutes = Math.round(Math.abs(value) * 60);
  return { h: String(sign * Math.floor(totalMinutes / 60)), m: String(totalMinutes % 60) };
}

/** { h, m } (strings) -> decimal hours as a string, or "" when both are blank. */
export function fromHoursMinutes({ h, m }) {
  if ((h === "" || h === undefined) && (m === "" || m === undefined)) return "";
  const hours = Number(h) || 0;
  const minutes = Number(m) || 0;
  const sign = hours < 0 ? -1 : 1;
  const value = sign * (Math.abs(hours) + minutes / 60);
  return String(value);
}

/** Decimal hours -> "Xh Ym" display string, e.g. 12.5 -> "12h 30m". "—" for blank/invalid. */
export function formatHoursMinutes(decimalHours) {
  if (decimalHours === "" || decimalHours === null || decimalHours === undefined) return "—";
  const value = Number(decimalHours);
  if (Number.isNaN(value)) return "—";
  const { h, m } = toHoursMinutes(value);
  const hNum = Number(h);
  return `${hNum < 0 ? "-" : ""}${Math.abs(hNum)}h ${m}m`;
}
