import { useCallback, useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import StatCard from "../../components/common/StatCard";
import FilterBar from "../../components/common/FilterBar";
import Select from "../../components/common/Select";
import DatePicker from "../../components/common/DatePicker";
import Table from "../../components/tables/Table";
import { generatorService } from "../../services/generatorService";
import { formatHoursMinutes } from "../../utils/hoursMinutes";
import { formatDate } from "../../utils/formatDate";

const COLUMNS = [
  { key: "generator", header: "Generator", render: (row) => <span className="font-medium text-ink">{row.generator.tag}</span> },
  { key: "hoursRun", header: "Hours Run", render: (row) => formatHoursMinutes(row.hoursRun) },
  { key: "logCount", header: "Log Entries", render: (row) => row.logCount },
];

/**
 * Spec 4.2's "monthly tracking of running hours", widened to an arbitrary
 * date range (defaults to "this month so far", same as the backend) so a
 * single day can be reported on too — pick the same day for From and To.
 * Zero-activity generators still show a 0 h row.
 */
export default function GeneratorReportRunningHours({ generatorOptions }) {
  const [generatorId, setGeneratorId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await generatorService.getRunningHoursReport({
        ...(generatorId ? { generatorId } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      });
      setReport(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [generatorId, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const handleReset = () => {
    setGeneratorId("");
    setFrom("");
    setTo("");
  };

  const rangeLabel = report ? `${formatDate(report.from)} – ${formatDate(report.to)}` : "";

  return (
    <div className="flex flex-col gap-5">
      <FilterBar
        filters={
          <>
            <Select value={generatorId} onChange={(e) => setGeneratorId(e.target.value)} options={generatorOptions} placeholder="All generators" />
            <DatePicker label="From" id="running-hours-filter-from" className="sm:w-40" clearable value={from} max={to || undefined} onChange={setFrom} />
            <DatePicker label="To" id="running-hours-filter-to" className="sm:w-40" clearable value={to} min={from || undefined} onChange={setTo} />
          </>
        }
        onReset={generatorId || from || to ? handleReset : undefined}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard label={`Total Hours Run — ${rangeLabel}`} value={report ? formatHoursMinutes(report.totalHoursRun) : "—"} icon={Clock3} />
      </div>

      <Table
        columns={COLUMNS}
        data={(report?.generators ?? []).map((row) => ({ ...row, id: row.generator.id }))}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="No generators to report on"
        emptyDescription="There are no active generators for this filter."
      />
    </div>
  );
}
