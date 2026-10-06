import { BadRequestError } from "../errors/AppError.js";

/**
 * "YYYY-MM" -> the UTC month it names as a [from, to) range, `to` exclusive.
 * No month given defaults to the current UTC month. Used by every
 * month-scoped report (running hours, fuel cost, ...) so "this month" means
 * the same thing everywhere.
 */
export function resolveMonthRange(month) {
  const now = new Date();
  let year = now.getUTCFullYear();
  let monthIndex = now.getUTCMonth(); // 0-based
  if (month) {
    const match = /^(\d{4})-(\d{2})$/.exec(month);
    if (!match) throw new BadRequestError("month must be in YYYY-MM format");
    year = Number(match[1]);
    monthIndex = Number(match[2]) - 1;
    if (monthIndex < 0 || monthIndex > 11) throw new BadRequestError("month must be between 01 and 12");
  }
  const from = new Date(Date.UTC(year, monthIndex, 1));
  const to = new Date(Date.UTC(year, monthIndex + 1, 1));
  return { from, to, year, month: monthIndex + 1 };
}

/**
 * An arbitrary [from, to] range (inclusive both ends, matching
 * generatorLogRepository.list's own from/to convention), for reports that
 * aren't locked to a calendar month. With nothing given, defaults to "this
 * month so far": from the 1st of the current UTC month, to now. An explicit
 * `to` is widened to the end of that UTC day (23:59:59.999) so a date-only
 * value — what every date picker in the app sends — includes everything
 * logged that day; this is what makes from === to work as "just this one
 * day" instead of matching only midnight-exact timestamps.
 */
export function resolveDateRange({ from, to } = {}) {
  const now = new Date();
  const resolvedTo = to ? endOfUTCDay(new Date(to)) : now;
  const resolvedFrom = from ? new Date(from) : new Date(Date.UTC(resolvedTo.getUTCFullYear(), resolvedTo.getUTCMonth(), 1));
  if (resolvedFrom > resolvedTo) throw new BadRequestError("from must not be after to");
  return { from: resolvedFrom, to: resolvedTo };
}

export function endOfUTCDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

/** A calendar year as a [from, to) range, `to` exclusive. No year given defaults to the current UTC year. */
export function resolveYearRange(year) {
  const now = new Date();
  const y = year ? Number(year) : now.getUTCFullYear();
  if (!Number.isInteger(y) || y < 2000 || y > 2100) throw new BadRequestError("year must be a 4-digit year between 2000 and 2100");
  const from = new Date(Date.UTC(y, 0, 1));
  const to = new Date(Date.UTC(y + 1, 0, 1));
  return { from, to, year: y };
}
