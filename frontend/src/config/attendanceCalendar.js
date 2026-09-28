// Single place to change the monthly attendance calendar's cutoff times. Display only: a
// check-in after LATE_CHECK_IN_AFTER or a check-out before EARLY_CHECK_OUT_BEFORE is shown in
// red on the calendar, but nothing here changes what the backend records as "late" or affects
// earlyDepartureMinutes - those are computed server-side against the shift/overtime threshold.
export const LATE_CHECK_IN_AFTER = "09:00";
export const EARLY_CHECK_OUT_BEFORE = "19:00";
