// Sample data for the calendar dev preview (?calendarDemo=1, see AttendanceCalendarContainer).
// Built relative to whichever month is being viewed so every state - present, late-in,
// early-out, no checkout, absent, and all four leave types - is visible no matter what today's
// real date is. Weekends and empty weekdays need no entry: AttendanceCalendar already renders
// those on its own from the plain grid.
const at = (year, month, day, hour, minute) => new Date(year, month, day, hour, minute).toISOString();
const dateStr = (year, month, day) => {
  const pad2 = (n) => String(n).padStart(2, "0");
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
};

export function buildSampleDays(year, month) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  // Keeps every sample day inside the visible month regardless of its length (28-31 days),
  // by offsetting from whichever end of the month has room rather than hardcoding day numbers.
  const day = (n) => Math.min(n, lastDay);

  return [
    { date: dateStr(year, month, day(2)), checkIn: at(year, month, day(2), 8, 45), checkOut: at(year, month, day(2), 19, 30) },
    { date: dateStr(year, month, day(3)), checkIn: at(year, month, day(3), 9, 45), checkOut: at(year, month, day(3), 18, 30) },
    { date: dateStr(year, month, day(4)), checkIn: at(year, month, day(4), 8, 30), checkOut: at(year, month, day(4), 17, 0) },
    { date: dateStr(year, month, day(5)), checkIn: at(year, month, day(5), 9, 10), checkOut: null },
    { date: dateStr(year, month, day(8)), status: "absent" },
    { date: dateStr(year, month, day(9)), leaveType: "casual" },
    { date: dateStr(year, month, day(10)), leaveType: "sick" },
    { date: dateStr(year, month, day(11)), leaveType: "annual" },
    { date: dateStr(year, month, day(12)), leaveType: "unpaid" },
  ];
}
