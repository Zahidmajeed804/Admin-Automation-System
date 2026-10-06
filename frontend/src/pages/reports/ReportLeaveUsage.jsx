import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, FileDown } from "lucide-react";
import StatCard from "../../components/common/StatCard";
import FilterBar from "../../components/common/FilterBar";
import Select from "../../components/common/Select";
import Button from "../../components/common/Button";
import Table from "../../components/tables/Table";
import { reportsService } from "../../services/reportsService";
import { formatNumber } from "../../utils/formatNumber";
import { saveBlob, extractErrorMessage } from "./reportHelpers";

const CURRENT_YEAR = new Date().getUTCFullYear();
// A handful of years around now — the backend accepts 2000-2100, but real
// leave history won't reach back that far. Same convention as the
// Generator module's operating-cost report year filter.
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 4 + i).map((y) => ({ value: String(y), label: String(y) }));

// Casual/sick/annual carry a balance (allocated/used/pending/remaining);
// unpaid has no allocation — same distinction the backend's export columns
// make (reportsController.js's QUOTA_LEAVE_TYPES/LEAVE_USAGE_COLUMNS).
const QUOTA_LEAVE_TYPES = ["casual", "sick", "annual"];

const STATUS_OPTIONS = [
  { value: "approved", label: "Approved" },
  { value: "pending", label: "Pending" },
  { value: "rejected", label: "Rejected" },
];

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

const COLUMNS = [
  { key: "name", header: "Employee", render: (row) => <span className="font-medium text-ink">{row.employee.name}</span> },
  { key: "department", header: "Department", render: (row) => row.employee.department || "—" },
  ...QUOTA_LEAVE_TYPES.flatMap((type) => [
    { key: `${type}Allocated`, header: `${capitalize(type)} Allocated`, render: (row) => formatNumber(row.leaveTypes[type].allocated) },
    { key: `${type}Used`, header: `${capitalize(type)} Used`, render: (row) => formatNumber(row.leaveTypes[type].used) },
    { key: `${type}Pending`, header: `${capitalize(type)} Pending`, render: (row) => formatNumber(row.leaveTypes[type].pending) },
    { key: `${type}Remaining`, header: `${capitalize(type)} Remaining`, render: (row) => formatNumber(row.leaveTypes[type].remaining) },
  ]),
  { key: "unpaidUsed", header: "Unpaid Used", render: (row) => formatNumber(row.leaveTypes.unpaid.approvedDays) },
  { key: "unpaidPending", header: "Unpaid Pending", render: (row) => formatNumber(row.leaveTypes.unpaid.pendingDays) },
  { key: "totalApprovedDays", header: "Total Approved Days", render: (row) => formatNumber(row.totalApprovedDays) },
];

// The field each status filters on, per leave type — "approved" reads
// approvedDays, etc. Used to decide whether an employee has any activity
// in the selected status, across every leave type including unpaid.
const STATUS_DAY_FIELD = { approved: "approvedDays", pending: "pendingDays", rejected: "rejectedDays" };
const ALL_LEAVE_TYPES = [...QUOTA_LEAVE_TYPES, "unpaid"];

function hasActivityInStatus(employeeRow, status) {
  const field = STATUS_DAY_FIELD[status];
  return ALL_LEAVE_TYPES.some((type) => (employeeRow.leaveTypes[type]?.[field] || 0) > 0);
}

/**
 * Leave Usage report (Module 7): per-employee leave usage by type and
 * status, plus balances (allocated/used/pending/remaining) for the quota
 * leave types. Scoped to a calendar year (defaults to the current one),
 * matching the backend's resolveYearRange. The status filter is
 * client-side only — the backend doesn't filter by status, so it narrows
 * the already-fetched rows to employees with activity in that status.
 */
export default function ReportLeaveUsage({ employeeOptions }) {
  const [employeeId, setEmployeeId] = useState("");
  const [year, setYear] = useState("");
  const [status, setStatus] = useState("");

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [exporting, setExporting] = useState(null); // "csv" | "pdf" | null

  const apiFilters = {
    ...(employeeId ? { employeeId } : {}),
    ...(year ? { year } : {}),
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await reportsService.getLeaveUsageReport(apiFilters);
      setReport(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, year]);

  useEffect(() => {
    load();
  }, [load]);

  const handleReset = () => {
    setEmployeeId("");
    setYear("");
    setStatus("");
  };

  const handleExport = async (format) => {
    setExporting(format);
    setExportError(null);
    try {
      const { blob, filename } = await reportsService.exportReport("leave-usage", { ...apiFilters, format });
      saveBlob(blob, filename);
    } catch (err) {
      setExportError(extractErrorMessage(err));
    } finally {
      setExporting(null);
    }
  };

  const employees = report?.employees ?? [];
  const rows = useMemo(
    () => (status ? employees.filter((row) => hasActivityInStatus(row, status)) : employees),
    [employees, status]
  );

  return (
    <div className="flex flex-col gap-5">
      <FilterBar
        filters={
          <>
            <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} options={employeeOptions} placeholder="All employees" />
            <Select value={year} onChange={(e) => setYear(e.target.value)} options={YEAR_OPTIONS} placeholder={`${CURRENT_YEAR} (current)`} />
            <Select value={status} onChange={(e) => setStatus(e.target.value)} options={STATUS_OPTIONS} placeholder="All statuses" />
          </>
        }
        onReset={employeeId || year || status ? handleReset : undefined}
        actions={
          <>
            <Button variant="secondary" size="sm" icon={FileDown} loading={exporting === "csv"} onClick={() => handleExport("csv")}>
              Export CSV
            </Button>
            <Button variant="secondary" size="sm" icon={FileDown} loading={exporting === "pdf"} onClick={() => handleExport("pdf")}>
              Export PDF
            </Button>
          </>
        }
      />

      {exportError && (
        <p className="text-body text-status-error bg-red-50 border border-red-200 rounded-md px-3 py-2">{exportError}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
        <StatCard label={`Total Approved Days — ${report?.year ?? CURRENT_YEAR}`} value={formatNumber(report?.totalApprovedDays)} icon={CalendarCheck} />
      </div>

      <Table
        columns={COLUMNS}
        data={rows.map((row) => ({ ...row, id: row.employee.id }))}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="No employees to report on"
        emptyDescription="There are no employees for this filter."
      />
    </div>
  );
}
