import { useCallback, useEffect, useState } from "react";
import { Clock, FileDown, Users } from "lucide-react";
import StatCard from "../../components/common/StatCard";
import FilterBar from "../../components/common/FilterBar";
import Select from "../../components/common/Select";
import DatePicker from "../../components/common/DatePicker";
import Button from "../../components/common/Button";
import Table from "../../components/tables/Table";
import { reportsService } from "../../services/reportsService";
import { formatDate } from "../../utils/formatDate";
import { formatNumber } from "../../utils/formatNumber";
import { saveBlob, extractErrorMessage } from "./reportHelpers";

const COLUMNS = [
  { key: "name", header: "Employee", render: (row) => <span className="font-medium text-ink">{row.employee.name}</span> },
  { key: "department", header: "Department", render: (row) => row.employee.department || "—" },
  { key: "present", header: "Present" },
  { key: "absent", header: "Absent" },
  { key: "halfDay", header: "Half Day" },
  { key: "late", header: "Late" },
  { key: "totalDays", header: "Total Days" },
  { key: "workedHours", header: "Worked Hours", render: (row) => formatNumber(row.workedHours) },
];

/**
 * Attendance Summary report (Module 7): per-employee status counts and
 * worked hours over an arbitrary date range (defaults to "this month so
 * far", matching the backend). Export buttons re-request the same filters
 * from the backend's export endpoint and save the resulting file.
 */
export default function ReportAttendanceSummary({ employeeOptions }) {
  const [employeeId, setEmployeeId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [exporting, setExporting] = useState(null); // "csv" | "pdf" | null

  const filters = {
    ...(employeeId ? { employeeId } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await reportsService.getAttendanceSummaryReport(filters);
      setReport(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const handleReset = () => {
    setEmployeeId("");
    setFrom("");
    setTo("");
  };

  const handleExport = async (format) => {
    setExporting(format);
    setExportError(null);
    try {
      const { blob, filename } = await reportsService.exportReport("attendance-summary", { ...filters, format });
      saveBlob(blob, filename);
    } catch (err) {
      setExportError(extractErrorMessage(err));
    } finally {
      setExporting(null);
    }
  };

  const rangeLabel = report ? `${formatDate(report.from)} – ${formatDate(report.to)}` : "";

  return (
    <div className="flex flex-col gap-5">
      <FilterBar
        filters={
          <>
            <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} options={employeeOptions} placeholder="All employees" />
            <DatePicker label="From" id="attendance-summary-filter-from" className="sm:w-40" clearable value={from} max={to || undefined} onChange={setFrom} />
            <DatePicker label="To" id="attendance-summary-filter-to" className="sm:w-40" clearable value={to} min={from || undefined} onChange={setTo} />
          </>
        }
        onReset={employeeId || from || to ? handleReset : undefined}
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard label={`Total Worked Hours — ${rangeLabel}`} value={formatNumber(report?.totalWorkedHours)} icon={Clock} />
        <StatCard label={`Total Days — ${rangeLabel}`} value={formatNumber(report?.totalDays)} icon={Users} />
      </div>

      <Table
        columns={COLUMNS}
        data={(report?.employees ?? []).map((row) => ({ ...row, id: row.employee.id }))}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="No employees to report on"
        emptyDescription="There are no employees for this filter."
      />
    </div>
  );
}
