// Leave types the API accepts, in the order they are offered.
export const leaveTypeOptions = [
  { value: "casual", label: "Casual leave" },
  { value: "sick", label: "Sick leave" },
  { value: "annual", label: "Annual leave" },
  { value: "unpaid", label: "Unpaid leave" },
];

// Leave dates are stored as midnight UTC, so render in UTC or users west of UTC see the previous day.
export const formatLeaveDate = (iso) =>
  new Date(iso).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export const leaveTypeLabel =Object.fromEntries(leaveTypeOptions.map((o) => [o.value, o.label]));

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Mirrors LEAVE_DATES_EDITABLE_AFTER_DAYS in backend/src/constants/attendance.js: a reviewer
// may change the dates of a pending request only if it was applied for more days than this.
export const LEAVE_DATES_EDITABLE_AFTER_DAYS = 2;

// Days the person originally applied for (before any reviewer edit).
export const appliedDays = (request) => request.originalTotalDays ?? request.totalDays;

export const canEditLeaveDates = (request) =>
  request.status === "pending" && appliedDays(request) > LEAVE_DATES_EDITABLE_AFTER_DAYS;

// Banner after a reviewer changes a request's dates, e.g. "Dates changed for Aisha:
// now 3 days (12 Oct 2026 – 14 Oct 2026), applied for 5. Approve or reject it when ready."
export const editedNotice = (request) => {
  const range =
    request.totalDays > 1
      ? `${formatLeaveDate(request.startDate)} – ${formatLeaveDate(request.endDate)}`
      : formatLeaveDate(request.startDate);
  const days = `${request.totalDays} ${request.totalDays === 1 ? "day" : "days"}`;
  return `Dates changed for ${request.user?.name || "this request"}: now ${days} (${range}), applied for ${appliedDays(request)}. Approve or reject it when ready.`;
};

// "2026-10-16T00:00:00.000Z" -> "2026-10-16". Leave dates are midnight UTC, so the ISO date part is the day.
export const toLeaveDateStr = (iso) => (iso ? String(iso).slice(0, 10) : "");

// Calendar days from start to end inclusive, for "YYYY-MM-DD" strings (same rule as the API).
// Returns 0 when either date is missing or the range is backwards.
export const inclusiveDays = (start, end) => {
  if (!start || !end) return 0;
  const days = Math.round((new Date(end) - new Date(start)) / MS_PER_DAY) + 1;
  return days > 0 ? days : 0;
};
