import clsx from "clsx";
import { formatNumber } from "../../utils/formatNumber";
import { formatHoursMinutes } from "../../utils/hoursMinutes";

// A job can be due by date, by running hours, both, or neither (see the
// backend's computeAlertStatus) — this shows whichever of the two the job
// actually tracks. Overdue reads as "by" (how far past), everything else as
// "in" (how far ahead), matching how a person would say either out loud.
// Its own file so both GeneratorMaintenancePage (the table) and
// GeneratorMaintenanceDetails (the modal) can import it without importing
// each other. `format` turns the raw magnitude into its displayed text, e.g.
// formatNumber+"d" for days or formatHoursMinutes for hours ("Xh Ym").
export function dueInLine(value, format) {
  if (value === undefined || value === null) return null;
  return value < 0 ? `Overdue by ${format(-value)}` : `Due in ${format(value)}`;
}

export function DueInfo({ row }) {
  if (row.status !== "scheduled") return null;
  const days = dueInLine(row.daysUntilDue, (v) => `${formatNumber(v)}d`);
  const hours = dueInLine(row.hoursUntilDue, formatHoursMinutes);
  if (!days && !hours) return null;
  const overdue = row.alertStatus === "overdue";
  return (
    <p className={clsx("text-helper mt-0.5", overdue ? "text-status-error font-medium" : "text-ink-muted")}>
      {[days, hours].filter(Boolean).join(" · ")}
    </p>
  );
}
