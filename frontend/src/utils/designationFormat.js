// Shift length in hours -> "8h", or "8h 30m" when it isn't a whole number of hours.
export const formatShiftHours = (hours) => {
  const totalMinutes = Math.round(Number(hours) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

// A populated designation -> "Engineer · 8h"; "" when there is none.
export const formatDesignation = (designation) =>
  designation?.name ? `${designation.name} · ${formatShiftHours(designation.shiftHours)}` : "";
