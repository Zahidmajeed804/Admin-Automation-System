// Leave types the API accepts, in the order they are offered.
export const leaveTypeOptions = [
  { value: "casual", label: "Casual leave" },
  { value: "sick", label: "Sick leave" },
  { value: "annual", label: "Annual leave" },
  { value: "unpaid", label: "Unpaid leave" },
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Calendar days from start to end inclusive, for "YYYY-MM-DD" strings (same rule as the API).
// Returns 0 when either date is missing or the range is backwards.
export const inclusiveDays = (start, end) => {
  if (!start || !end) return 0;
  const days = Math.round((new Date(end) - new Date(start)) / MS_PER_DAY) + 1;
  return days > 0 ? days : 0;
};
