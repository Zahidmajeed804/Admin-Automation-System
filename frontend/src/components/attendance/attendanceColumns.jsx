import Badge from "../common/Badge";
import {
  formatDate,
  formatTime,
  formatDuration,
  statusBadgeKey,
} from "../../utils/attendanceFormat";

// Column definitions shared by every attendance table (own history, team view).
export const attendanceColumns = [
  { key: "date", header: "Date", render: (row) => formatDate(row.date) },
  { key: "clockIn", header: "Clock in", render: (row) => (row.clockIn ? formatTime(row.clockIn) : "—") },
  { key: "clockOut", header: "Clock out", render: (row) => (row.clockOut ? formatTime(row.clockOut) : "—") },
  {
    key: "workedMinutes",
    header: "Worked",
    // workedMinutes is only final once the day is clocked out.
    render: (row) => (row.clockOut ? formatDuration(row.workedMinutes) : "—"),
  },
  { key: "status", header: "Status", render: (row) => <Badge status={statusBadgeKey[row.status]} /> },
  {
    key: "notes",
    header: "Notes",
    render: (row) =>
      row.notes ? (
        <span className="block max-w-[16rem] truncate" title={row.notes}>
          {row.notes}
        </span>
      ) : (
        "—"
      ),
  },
];
