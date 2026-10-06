import { Clock, Hourglass, Percent } from "lucide-react";
import StatCard from "../../common/StatCard";
import { formatMinutes, formatPercent } from "../../../utils/summaryFormat";

/**
 * The month's headline numbers: approved overtime (all listed staff), overtime still
 * pending review, and the average attendance %. `totals` is summary.totals.
 */
export default function MonthlySummaryStats({ totals, loading }) {
  const value = (v) => (loading || !totals ? "…" : v);
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard label="Approved overtime" value={value(formatMinutes(totals?.approvedOvertimeMinutes))} icon={Clock} />
      <StatCard
        label="Pending overtime"
        value={value(formatMinutes(totals?.pendingOvertimeMinutes))}
        icon={Hourglass}
        iconColor="text-status-warning"
        iconBg="bg-status-warningBg"
      />
      <StatCard
        label="Average attendance"
        value={value(formatPercent(totals?.averageAttendancePercent))}
        icon={Percent}
        iconColor="text-status-success"
        iconBg="bg-status-successBg"
      />
    </div>
  );
}
