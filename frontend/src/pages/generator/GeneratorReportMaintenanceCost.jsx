import { useCallback, useEffect, useState } from "react";
import { Wrench, Hash } from "lucide-react";
import StatCard from "../../components/common/StatCard";
import FilterBar from "../../components/common/FilterBar";
import Select from "../../components/common/Select";
import DatePicker from "../../components/common/DatePicker";
import Table from "../../components/tables/Table";
import { generatorService } from "../../services/generatorService";
import { formatDate } from "../../utils/formatDate";
import { formatNumber } from "../../utils/formatNumber";
import { describeError } from "../../utils/errorMessage";

const COLUMNS = [
  { key: "generator", header: "Generator", render: (row) => <span className="font-medium text-ink">{row.generator.tag}</span> },
  { key: "cost", header: "Cost", render: (row) => formatNumber(row.cost) },
  { key: "jobCount", header: "Completed Jobs", render: (row) => row.jobCount },
];

/**
 * Spec 4.2's "maintenance — cost" report — total cost per generator from
 * completed maintenance jobs over an arbitrary date range (defaults to
 * "this month so far", matching the backend). Scheduled/cancelled jobs never
 * count, since only a completed job is an actual cost.
 */
export default function GeneratorReportMaintenanceCost({ generatorOptions }) {
  const [generatorId, setGeneratorId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await generatorService.getMaintenanceCostReport({
        ...(generatorId ? { generatorId } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      });
      setReport(data);
    } catch (err) {
      setError(err);
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
            <DatePicker label="From" id="maintenance-cost-filter-from" className="sm:w-40" clearable value={from} max={to || undefined} onChange={setFrom} />
            <DatePicker label="To" id="maintenance-cost-filter-to" className="sm:w-40" clearable value={to} min={from || undefined} onChange={setTo} />
          </>
        }
        onReset={generatorId || from || to ? handleReset : undefined}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard label={`Total Cost — ${rangeLabel}`} value={report ? formatNumber(report.totalCost) : "—"} icon={Wrench} />
        <StatCard label="Completed Jobs" value={report ? report.totalJobCount : "—"} icon={Hash} />
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
