// Attendance and leave dates are stored normalized to midnight UTC, so every
// day-level lookup or filter normalizes the same way.
export const startOfDay = (date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};
