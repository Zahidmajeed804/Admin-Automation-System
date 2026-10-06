import Card from "../../common/Card";
import SummaryPie from "./SummaryPie";
import { categoricalPalette } from "../../../config/theme";

const days = (n) => `${n} ${n === 1 ? "day" : "days"}`;

/**
 * One person's month split into present / late / half-day / absent / leave days.
 * Shown when the summary is narrowed to a single employee. Slice order is fixed so
 * each kind keeps its colour across people and months.
 */
export default function AttendanceBreakdownChart({ row }) {
  const parts = [
    ["Present", row.attendance.present],
    ["Late", row.attendance.late],
    ["Half-day", row.attendance.halfDay],
    ["Absent", row.attendance.absent],
    ["Leave", row.leaveDays],
  ];
  const slices = parts.map(([name, value], i) => ({ name, value, display: days(value), color: categoricalPalette[i] }));
  const any = slices.some((s) => s.value > 0);

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h3 className="text-section-heading text-ink">Attendance breakdown</h3>
        <p className="text-helper text-ink-muted">{row.user.name}, days this month.</p>
      </div>
      {any ? (
        <SummaryPie slices={slices} chartId="attendance-breakdown" label={`Attendance breakdown for ${row.user.name}`} />
      ) : (
        <p className="text-body text-ink-muted py-6 text-center" data-chart="attendance-breakdown">
          No attendance or leave recorded this month.
        </p>
      )}
    </Card>
  );
}
