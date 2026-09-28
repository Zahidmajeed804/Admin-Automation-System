import { ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { buildMonthGrid, toDateStr, monthLabel, WEEKDAYS } from "../common/DatePicker";
import { LATE_CHECK_IN_AFTER, EARLY_CHECK_OUT_BEFORE } from "../../config/attendanceCalendar";
import { formatTime } from "../../utils/attendanceFormat";

const LEAVE_ABBR = { casual: "CL", sick: "SL", annual: "AL", unpaid: "UL" };

const LEAVE_STYLES = {
  casual: "bg-slate-100 border-slate-300 text-slate-700",
  sick: "bg-amber-50 border-amber-200 text-amber-700",
  annual: "bg-purple-50 border-purple-200 text-purple-700",
  unpaid: "bg-rose-50 border-rose-200 text-rose-700",
};

const parseHHMM = (s) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};

const minutesOfDay = (iso) => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};

const isLateIn = (checkIn) => Boolean(checkIn) && minutesOfDay(checkIn) > parseHHMM(LATE_CHECK_IN_AFTER);
const isEarlyOut = (checkOut) => Boolean(checkOut) && minutesOfDay(checkOut) < parseHHMM(EARLY_CHECK_OUT_BEFORE);

function DayCell({ day, isToday, isWeekend }) {
  if (!day) {
    // Leading/trailing day from another month: an empty shaded box, no date number.
    return <div className="rounded-md bg-surface-subtle/60 min-h-[76px] sm:min-h-[88px]" aria-hidden="true" />;
  }

  const { dateObj, dateStr, status, checkIn, checkOut, leaveType } = day;
  const dayNum = dateObj.getDate();

  const dateBadge = (
    <span
      className={clsx(
        "text-helper font-medium",
        isToday ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white" : "text-ink-muted"
      )}
    >
      {dayNum}
    </span>
  );

  // Leave takes priority (most specific/actionable), then a real attendance record, then an
  // explicit "absent" correction, then weekends default to Holiday, then it's just an empty day
  // (a future date, or a weekday nobody has clocked in for yet).
  let body;
  let cardClass;
  if (leaveType) {
    cardClass = LEAVE_STYLES[leaveType] || LEAVE_STYLES.casual;
    body = (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-card-heading font-semibold">{LEAVE_ABBR[leaveType] || "L"}</span>
      </div>
    );
  } else if (checkIn) {
    cardClass = "bg-status-successBg border-green-200 text-status-success";
    const lateIn = isLateIn(checkIn);
    const earlyOut = isEarlyOut(checkOut);
    body = (
      <div className="flex flex-col gap-0.5 text-helper">
        <span className={clsx("font-medium", lateIn ? "text-status-error" : "text-status-success")}>
          In {formatTime(checkIn)}
        </span>
        <span className={clsx("font-medium", checkOut ? (earlyOut ? "text-status-error" : "text-status-success") : "text-ink-muted")}>
          {checkOut ? `Out ${formatTime(checkOut)}` : "----"}
        </span>
      </div>
    );
  } else if (status === "absent") {
    cardClass = "bg-status-errorBg border-red-200 text-status-error";
    body = (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-helper font-medium">Absent</span>
      </div>
    );
  } else if (isWeekend) {
    cardClass = "bg-pink-50 border-pink-200 text-pink-700";
    body = (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-helper font-medium">Holiday</span>
      </div>
    );
  } else {
    cardClass = "bg-white border-border text-ink-muted";
    body = null;
  }

  return (
    <div
      data-date={dateStr}
      className={clsx(
        "flex flex-col gap-1 rounded-md border p-2 min-h-[76px] sm:min-h-[88px] transition-shadow duration-150 hover:shadow-elevated",
        cardClass,
        isToday && "ring-2 ring-primary ring-offset-1"
      )}
    >
      <div className="flex items-center justify-between">{dateBadge}</div>
      {body}
    </div>
  );
}

/**
 * Pure monthly calendar grid (no data fetching of its own - AttendanceCalendarContainer does
 * that). `days` is [{ date: "YYYY-MM-DD", status, checkIn: iso|null, checkOut: iso|null,
 * leaveType?: "casual"|"sick"|"annual"|"unpaid" }] for the visible month; a day with no matching
 * entry renders as an empty cell. `year`/`month` (0-indexed) pick which month is shown;
 * `onPrevMonth`/`onNextMonth` are called with no arguments to ask the caller to move a month.
 */
export default function AttendanceCalendar({ year, month, days, onPrevMonth, onNextMonth }) {
  const grid = buildMonthGrid(year, month);
  const byDate = Object.fromEntries((days || []).map((d) => [d.date, d]));
  const todayStr = toDateStr(new Date());

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={onPrevMonth}
          className="h-9 w-9 rounded-md flex items-center justify-center text-ink-muted hover:bg-surface-subtle hover:text-ink transition-colors duration-150"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-section-heading text-ink">{monthLabel(year, month)}</span>
        <button
          type="button"
          aria-label="Next month"
          onClick={onNextMonth}
          className="h-9 w-9 rounded-md flex items-center justify-center text-ink-muted hover:bg-surface-subtle hover:text-ink transition-colors duration-150"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {WEEKDAYS.map((w) => (
          <span key={w} className="text-helper text-ink-muted font-medium text-center py-1">
            {w}
          </span>
        ))}
        {grid.map((dateObj, i) => {
          if (!dateObj) return <DayCell key={i} day={null} />;
          const dateStr = toDateStr(dateObj);
          const entry = byDate[dateStr];
          const weekday = dateObj.getDay();
          return (
            <DayCell
              key={dateStr}
              isToday={dateStr === todayStr}
              isWeekend={weekday === 0 || weekday === 6}
              day={{
                dateObj,
                dateStr,
                status: entry?.status,
                checkIn: entry?.checkIn || null,
                checkOut: entry?.checkOut || null,
                leaveType: entry?.leaveType || null,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
