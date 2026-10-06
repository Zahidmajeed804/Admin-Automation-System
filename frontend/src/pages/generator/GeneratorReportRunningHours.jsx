import { useCallback, useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import StatCard from "../../components/common/StatCard";
import FilterBar from "../../components/common/FilterBar";
import Select from "../../components/common/Select";
import Input from "../../components/common/Input";
import Table from "../../components/tables/Table";
import { generatorService } from "../../services/generatorService";
import { formatNumber } from "../../utils/formatNumber";
import { describeError } from "../../utils/errorMessage";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const COLUMNS = [
  { key: "generator", header: "Generator", render: (row) => <span className="font-medium text-ink">{row.generator.tag}</span> },
  { key: "hoursRun", header: "Hours Run", render: (row) => `${formatNumber(row.hoursRun)} h` },
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
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await generatorService.getRunningHoursReport({
        ...(generatorId ? { generatorId } : {}),
        ...(month ? { month } : {}),
      });
      setReport(data);
    } catch (err) {
      setError(err);
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
        <StatCard label={`Total Hours Run — ${periodLabel}`} value={report ? `${formatNumber(report.totalHoursRun)} h` : "—"} icon={Clock3} />
      </div>

      <Table
        columns={COLUMNS}
        data={(report?.generators ?? []).map((row) => ({ ...row, id: row.generator.id }))}
        loading={loading}
        error={error}
        errorDescription={error ? describeError(error) : undefined}
        onRetry={load}
        emptyTitle="No generators to report on"
        emptyDescription="There are no active generators for this filter."
      />
    </div>
  );
}
