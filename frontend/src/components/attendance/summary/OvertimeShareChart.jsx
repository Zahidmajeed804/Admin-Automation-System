import Card from "../../common/Card";
import SummaryPie from "./SummaryPie";
import { categoricalPalette, otherSliceColor } from "../../../config/theme";
import { formatMinutes } from "../../../utils/summaryFormat";

/**
 * Each person's share of the month's approved overtime. The top people get the
 * palette slots in order; everyone after that folds into one "Others" slice, so a
 * colour is never reused. Loaded lazily (recharts) by the summary page and dashboard.
 */
export default function OvertimeShareChart({ staff = [] }) {
  const withOvertime = staff
    .filter((r) => r.overtime.approvedMinutes > 0)
    .sort((a, b) => b.overtime.approvedMinutes - a.overtime.approvedMinutes);
  const top = withOvertime.slice(0, categoricalPalette.length);
  const rest = withOvertime.slice(categoricalPalette.length);

  const slices = top.map((r, i) => ({
    name: r.user.name,
    value: r.overtime.approvedMinutes,
    display: formatMinutes(r.overtime.approvedMinutes),
    color: categoricalPalette[i],
  }));
  if (rest.length) {
    const minutes = rest.reduce((sum, r) => sum + r.overtime.approvedMinutes, 0);
    slices.push({
      name: `Others (${rest.length})`,
      value: minutes,
      display: formatMinutes(minutes),
      color: otherSliceColor,
    });
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h3 className="text-section-heading text-ink">Overtime share</h3>
        <p className="text-helper text-ink-muted">Approved overtime this month, per person.</p>
      </div>
      {slices.length ? (
        <SummaryPie slices={slices} chartId="overtime-share" label="Share of approved overtime per person" />
      ) : (
        <p className="text-body text-ink-muted py-6 text-center" data-chart="overtime-share">
          No approved overtime this month.
        </p>
      )}
    </Card>
  );
}
