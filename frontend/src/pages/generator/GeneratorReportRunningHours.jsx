import { useCallback, useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import StatCard from "../../components/common/StatCard";
import FilterBar from "../../components/common/FilterBar";
import Select from "../../components/common/Select";
import Input from "../../components/common/Input";
import Table from "../../components/tables/Table";
import { generatorService } from "../../services/generatorService";
import { formatHoursMinutes } from "../../utils/hoursMinutes";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const COLUMNS = [
  { key: "generator", header: "Generator", render: (row) => <span className="font-medium text-ink">{row.generator.tag}</span> },
  { key: "hoursRun", header: "Hours Run", render: (row) => formatHoursMinutes(row.hoursRun) },
  { key: "logCount", header: "Log Entries", render: (row) => row.logCount },
];

/**
 * Spec 4.2's "monthly tracking of running hours" — total hours run per
 * generator for a chosen calendar month (defaults to the current one, same
 * as the backend). Zero-activity generators still show a 0 h row.
 */
export default function GeneratorReportRunningHours({ generatorOptions }) {
  const [generatorId, setGeneratorId] = useState("");
  const [month, setMonth] = useState("");

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await generatorService.getRunningHoursReport({
        ...(generatorId ? { generatorId } : {}),
        ...(month ? { month } : {}),
      });
      setReport(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [generatorId, month]);

  useEffect(() => {
    load();
  }, [load]);

  const handleReset = () => {
    setGeneratorId("");
    setMonth("");
  };

  const periodLabel = report ? `${MONTH_NAMES[report.month - 1]} ${report.year}` : "—";

  return (
    <div className="flex flex-col gap-5">
      <FilterBar
        filters={
          <>
            <Select value={generatorId} onChange={(e) => setGeneratorId(e.target.value)} options={generatorOptions} placeholder="All generators" />
            <Input type="month" aria-label="Month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </>
        }
        onReset={generatorId || month ? handleReset : undefined}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard label={`Total Hours Run — ${periodLabel}`} value={report ? formatHoursMinutes(report.totalHoursRun) : "—"} icon={Clock3} />
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
