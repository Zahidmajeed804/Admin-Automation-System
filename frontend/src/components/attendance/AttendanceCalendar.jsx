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

const LEGEND = [
  { label: "Present", swatch: "bg-status-successBg border-green-200" },
  { label: "Late in / early out", swatch: "bg-status-successBg border-status-error" },
  { label: "Absent", swatch: "bg-status-errorBg border-red-200" },
  { label: "Holiday", swatch: "bg-pink-50 border-pink-200" },
  { label: "Casual leave (CL)", swatch: LEAVE_STYLES.casual },
  { label: "Sick leave (SL)", swatch: LEAVE_STYLES.sick },
  { label: "Annual leave (AL)", swatch: LEAVE_STYLES.annual },
  { label: "Unpaid leave (UL)", swatch: LEAVE_STYLES.unpaid },
];

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

// Single source of truth for what a day "is", shared by the cell renderer and the summary count
// so the two can never disagree. Leave takes priority (most specific/actionable), then a real
// attendance record, then an explicit "absent" correction, then weekends default to Holiday,
// then it's just an empty day (a future date, or a weekday nobody has clocked in for yet).
function resolveDay(entry, isWeekend) {
  const leaveType = entry?.leaveType || null;
  const checkIn = entry?.checkIn || null;
  const checkOut = entry?.checkOut || null;
  if (leaveType) return { kind: "leave", leaveType };
  if (checkIn) return { kind: "present", checkIn, checkOut, lateIn: isLateIn(checkIn), earlyOut: isEarlyOut(checkOut) };
  if (entry?.status === "absent") return { kind: "absent" };
  if (isWeekend) return { kind: "holiday" };
  return { kind: "empty" };
}

function DayCell({ dateObj, dateStr, resolved, isToday }) {
  if (!dateObj) {
    // Leading/trailing day from another month: an empty shaded box, no date number.
    return <div className="rounded-md bg-surface-subtle/60 min-h-[76px] sm:min-h-[88px]" aria-hidden="true" />;
  }

  const dateBadge = (
    <span
      className={clsx(
        "text-helper font-medium",
        isToday ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white" : "text-ink-muted"
      )}
    >
      {dateObj.getDate()}
    </span>
  );

  let body;
  let cardClass;
  if (resolved.kind === "leave") {
    cardClass = LEAVE_STYLES[resolved.leaveType] || LEAVE_STYLES.casual;
    body = (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-card-heading font-semibold">{LEAVE_ABBR[resolved.leaveType] || "L"}</span>
      </div>
    );
  } else if (resolved.kind === "present") {
    cardClass = "bg-status-successBg border-green-200 text-status-success";
    body = (
      <div className="flex flex-col gap-0.5 text-helper">
        <span className={clsx("font-medium", resolved.lateIn ? "text-status-error" : "text-status-success")}>
          In {formatTime(resolved.checkIn)}
        </span>
        <span
          className={clsx(
            "font-medium",
            resolved.checkOut ? (resolved.earlyOut ? "text-status-error" : "text-status-success") : "text-ink-muted"
          )}
        >
          {resolved.checkOut ? `Out ${formatTime(resolved.checkOut)}` : "----"}
        </span>
      </div>
    );
  } else if (resolved.kind === "absent") {
    cardClass = "bg-status-errorBg border-red-200 text-status-error";
    body = (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-helper font-medium">Absent</span>
      </div>
    );
  } else if (resolved.kind === "holiday") {
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

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {LEGEND.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5 text-helper text-ink-muted">
          <span className={clsx("h-3 w-3 rounded-sm border", item.swatch)} aria-hidden="true" />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function Summary({ counts }) {
  const items = [
    { label: "Present", value: counts.present },
    { label: "Late", value: counts.late },
    { label: "Leave", value: counts.leave },
    { label: "Holidays", value: counts.holiday },
  ];
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1">
      {items.map((item) => (
        <span key={item.label} className="text-body text-ink-secondary">
          <span className="font-semibold text-ink">{item.value}</span> {item.label}
        </span>
      ))}
    </div>
  );
}

/**
 * Pure monthly calendar grid (no data fetching of its own - AttendanceCalendarContainer does
 * that). `days` is [{ date: "YYYY-MM-DD", status, checkIn: iso|null, checkOut: iso|null,
 * leaveType?: "casual"|"sick"|"annual"|"unpaid" }] for the visible month; a day with no matching
 * entry renders as an empty cell. `year`/`month` (0-indexed) pick which month is shown;
 * `onPrevMonth`/`onNextMonth` are called with no arguments to ask the caller to move a month.
 * Shows a running summary (present/late/leave/holiday counts) and a colour legend above the grid.
 */
export default function AttendanceCalendar({ year, month, days, onPrevMonth, onNextMonth }) {
  const grid = buildMonthGrid(year, month);
  const byDate = Object.fromEntries((days || []).map((d) => [d.date, d]));
  const todayStr = toDateStr(new Date());

  const resolvedByDate = {};
  const counts = { present: 0, late: 0, leave: 0, holiday: 0 };
  for (const dateObj of grid) {
    if (!dateObj) continue;
    const dateStr = toDateStr(dateObj);
    const weekday = dateObj.getDay();
    const resolved = resolveDay(byDate[dateStr], weekday === 0 || weekday === 6);
    resolvedByDate[dateStr] = resolved;
    if (resolved.kind === "present") {
      counts.present += 1;
      if (resolved.lateIn || resolved.earlyOut) counts.late += 1;
    } else if (resolved.kind === "leave") {
      counts.leave += 1;
    } else if (resolved.kind === "holiday") {
      counts.holiday += 1;
    }
  }

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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Summary counts={counts} />
        <Legend />
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {WEEKDAYS.map((w) => (
          <span key={w} className="text-helper text-ink-muted font-medium text-center py-1">
            {w}
          </span>
        ))}
        {grid.map((dateObj, i) => {
          if (!dateObj) return <DayCell key={i} dateObj={null} />;
          const dateStr = toDateStr(dateObj);
          return (
            <DayCell key={dateStr} dateObj={dateObj} dateStr={dateStr} resolved={resolvedByDate[dateStr]} isToday={dateStr === todayStr} />
          );
        })}
      </div>
    </div>
  );
}
