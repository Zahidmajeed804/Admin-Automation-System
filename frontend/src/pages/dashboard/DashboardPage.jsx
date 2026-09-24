import { CalendarDays, Clock, Timer } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { attendanceService } from "../../services/attendanceService";
import { overtimeService } from "../../services/overtimeService";
import { leaveService } from "../../services/leaveService";
import PageHeader from "../../components/common/PageHeader";
import Card from "../../components/common/Card";
import SummaryCard from "../../components/dashboard/SummaryCard";
import { formatDuration, formatTime } from "../../utils/attendanceFormat";

// Highlights a tile whose count needs someone's attention.
const attentionTone = { iconColor: "text-status-warning", iconBg: "bg-status-warningBg" };

// Loaders are module-level so each tile keeps a stable function across renders.
const loadToday = () =>
  attendanceService.today().then((record) => {
    if (!record?.clockIn) return { value: "Not clocked in" };
    if (!record.clockOut) {
      return { value: `Clocked in at ${formatTime(record.clockIn)}`, tone: { iconColor: "text-status-success", iconBg: "bg-status-successBg" } };
    }
    return { value: `Clocked out · ${formatDuration(record.workedMinutes)}` };
  });

// pageSize 1: only the total is needed, not the rows.
const loadPending = (service) => () =>
  service.list({ status: "pending", pageSize: 1 }).then(({ pagination }) => ({
    value: pagination.totalItems,
    tone: pagination.totalItems > 0 ? attentionTone : undefined,
  }));
const loadPendingOvertime = loadPending(overtimeService);
const loadPendingLeave = loadPending(leaveService);

export default function DashboardPage() {
  const { hasPermission } = useAuth();

  // Each tile mirrors the permission its API needs; the API enforces the same rules independently.
  const showToday = hasPermission("attendance.read");
  const showOvertime = hasPermission("overtime.approve");
  const showLeave = hasPermission("leave.approve") || hasPermission("leave.reject");

  return (
    <>
      <PageHeader title="Dashboard" description="Your attendance and pending approvals at a glance." />
      {showToday || showOvertime || showLeave ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {showToday && <SummaryCard label="Today's attendance" icon={Clock} to="/attendance" load={loadToday} />}
          {showOvertime && (
            <SummaryCard label="Overtime awaiting approval" icon={Timer} to="/attendance/overtime" load={loadPendingOvertime} />
          )}
          {showLeave && (
            <SummaryCard label="Leave awaiting approval" icon={CalendarDays} to="/attendance/leave" load={loadPendingLeave} />
          )}
        </div>
      ) : (
        <Card className="text-body text-ink-muted">Nothing to show here yet.</Card>
      )}
    </>
  );
}
