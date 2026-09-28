import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import AttendanceCalendar from "./AttendanceCalendar";
import Button from "../common/Button";
import { attendanceService } from "../../services/attendanceService";
import { leaveService } from "../../services/leaveService";
import { toDateStr, parseDateStr, addDays } from "../common/DatePicker";

const pad2 = (n) => String(n).padStart(2, "0");

// Attendance.date and LeaveRequest start/endDate are stored as midnight UTC (same convention as
// utils/attendanceFormat.js's formatDate), so read them back in UTC or users west of UTC would
// see everything shifted a day earlier.
const dateKeyUTC = (iso) => {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
};

const clampStr = (s, min, max) => (s < min ? min : s > max ? max : s);

// Every "YYYY-MM-DD" from start to end inclusive.
const eachDateStr = (startStr, endStr) => {
  const out = [];
  let d = parseDateStr(startStr);
  const end = parseDateStr(endStr);
  while (toDateStr(d) <= toDateStr(end)) {
    out.push(toDateStr(d));
    d = addDays(d, 1);
  }
  return out;
};

// Merges a month's attendance records and approved leave requests into the flat `days` list
// AttendanceCalendar expects, keyed by date. A leave request can start or end outside the
// visible month, so it's clipped to [monthStart, monthEnd] before expanding into per-day entries.
function buildDays(attendanceItems, leaveItems, monthStart, monthEnd) {
  const byDate = {};
  for (const a of attendanceItems) {
    const key = dateKeyUTC(a.date);
    byDate[key] = { date: key, status: a.status, checkIn: a.clockIn, checkOut: a.clockOut };
  }
  for (const l of leaveItems) {
    const start = clampStr(dateKeyUTC(l.startDate), monthStart, monthEnd);
    const end = clampStr(dateKeyUTC(l.endDate), monthStart, monthEnd);
    if (start > end) continue;
    for (const dateStr of eachDateStr(start, end)) {
      byDate[dateStr] = { ...(byDate[dateStr] || { date: dateStr }), leaveType: l.leaveType };
    }
  }
  return Object.values(byDate);
}

const MAX_RECORDS_PER_MONTH = 100;

/**
 * Fetches one month's attendance + approved leave for `userId` (omit for "my own", per
 * attendanceService/leaveService's own scoping - a non-reviewer's userId is ignored server-side
 * regardless) and renders it through the pure AttendanceCalendar. Owns which month is visible.
 */
export default function AttendanceCalendarContainer({ userId }) {
  const now = new Date();
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [result, setResult] = useState({ key: null, days: [], failed: false });
  const [attempt, setAttempt] = useState(0);

  const requestKey = JSON.stringify([userId, view, attempt]);
  const loading = result.key !== requestKey;

  useEffect(() => {
    let cancelled = false;
    const monthStart = toDateStr(new Date(view.year, view.month, 1));
    const monthEnd = toDateStr(new Date(view.year, view.month + 1, 0));

    Promise.all([
      attendanceService.list({ userId, startDate: monthStart, endDate: monthEnd, page: 1, pageSize: MAX_RECORDS_PER_MONTH }),
      leaveService.list({
        userId,
        status: "approved",
        startDate: monthStart,
        endDate: monthEnd,
        page: 1,
        pageSize: MAX_RECORDS_PER_MONTH,
      }),
    ])
      .then(([attendance, leave]) => {
        if (cancelled) return;
        setResult({ key: requestKey, days: buildDays(attendance.items, leave.items, monthStart, monthEnd), failed: false });
      })
      .catch(() => {
        if (cancelled) return;
        setResult({ key: requestKey, days: [], failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [userId, view, requestKey]);

  const changeMonth = (delta) => {
    setView(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  if (result.failed) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-body text-ink-muted">Couldn't load the calendar. Please try again.</p>
        <Button variant="secondary" size="sm" icon={RotateCcw} onClick={() => setAttempt((a) => a + 1)}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={loading ? "opacity-60 transition-opacity duration-150" : undefined}>
      <AttendanceCalendar
        year={view.year}
        month={view.month}
        days={result.days}
        onPrevMonth={() => changeMonth(-1)}
        onNextMonth={() => changeMonth(1)}
      />
    </div>
  );
}
