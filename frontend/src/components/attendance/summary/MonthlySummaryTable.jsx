import Table from "../../tables/Table";
import Badge from "../../common/Badge";
import { formatMinutes, formatPercent, percentBadgeStatus } from "../../../utils/summaryFormat";

const columns = [
  {
    key: "employee",
    header: "Employee",
    render: (row) => (
      <div className="flex flex-col">
        <span className="font-medium text-ink">{row.user.name}</span>
        <span className="text-helper text-ink-muted">
          {[row.user.employeeId, row.user.designation?.name].filter(Boolean).join(" · ") || "—"}
        </span>
      </div>
    ),
  },
  {
    key: "overtime",
    header: "Overtime",
    render: (row) => (
      <div className="flex flex-col">
        <span className="text-ink">{formatMinutes(row.overtime.approvedMinutes)}</span>
        {row.overtime.pendingMinutes > 0 && (
          <span className="text-helper text-status-warning">+{formatMinutes(row.overtime.pendingMinutes)} pending</span>
        )}
      </div>
    ),
  },
  { key: "present", header: "Present", render: (row) => row.attendance.present },
  { key: "late", header: "Late", render: (row) => row.attendance.late },
  { key: "halfDay", header: "Half-day", render: (row) => row.attendance.halfDay },
  { key: "absent", header: "Absent", render: (row) => row.attendance.absent },
  { key: "leaveDays", header: "Leave days", render: (row) => row.leaveDays },
  {
    key: "attendancePercent",
    header: "Attendance",
    render: (row) => (
      <span title={`${row.workingDays} working day(s) so far, ${row.leaveWorkingDays} on approved leave`}>
        <Badge status={percentBadgeStatus(row.attendancePercent)}>{formatPercent(row.attendancePercent)}</Badge>
      </span>
    ),
  },
];

/**
 * One row per person for the month: overtime (approved, plus pending), day counts,
 * approved leave days and attendance %. `staff` is summary.staff.
 */
export default function MonthlySummaryTable({ staff, loading, failed, onRetry, emptyDescription }) {
  return (
    <Table
      columns={columns}
      data={(staff || []).map((row) => ({ ...row, id: row.user._id }))}
      keyField="id"
      loading={loading}
      error={failed}
      onRetry={onRetry}
      emptyTitle="No one to show for this month"
      emptyDescription={emptyDescription}
    />
  );
}
