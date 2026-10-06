import { useCallback, useEffect, useState } from "react";
import { Droplet, Fuel } from "lucide-react";
import StatCard from "../../components/common/StatCard";
import FilterBar from "../../components/common/FilterBar";
import Select from "../../components/common/Select";
import Input from "../../components/common/Input";
import Table from "../../components/tables/Table";
import { generatorService } from "../../services/generatorService";
import { formatDate } from "../../utils/formatDate";
import { formatNumber } from "../../utils/formatNumber";
import { describeError } from "../../utils/errorMessage";

const COLUMNS = [
  { key: "generator", header: "Generator", render: (row) => <span className="font-medium text-ink">{row.generator.tag}</span> },
  { key: "fuelAddedLiters", header: "Fuel Added", render: (row) => `${formatNumber(row.fuelAddedLiters)} L` },
  { key: "fuelConsumedLiters", header: "Fuel Consumed", render: (row) => `${formatNumber(row.fuelConsumedLiters)} L` },
  { key: "logCount", header: "Log Entries", render: (row) => row.logCount },
];

/**
 * Spec 4.2's "diesel consumption" report — additions and consumption per
 * generator over an arbitrary date range (defaults to "this month so far",
 * matching the backend). Opening/closing readings are per-log detail already
 * shown on the Fuel & Usage Logs tab, not repeated here.
 */
export default function GeneratorReportDieselConsumption({ generatorOptions }) {
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
      const data = await generatorService.getDieselConsumptionReport({
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
            <Input type="date" aria-label="From date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" aria-label="To date" value={to} onChange={(e) => setTo(e.target.value)} />
          </>
        }
        onReset={generatorId || from || to ? handleReset : undefined}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard label={`Fuel Added — ${rangeLabel}`} value={report ? `${formatNumber(report.totalFuelAddedLiters)} L` : "—"} icon={Fuel} />
        <StatCard label={`Fuel Consumed — ${rangeLabel}`} value={report ? `${formatNumber(report.totalFuelConsumedLiters)} L` : "—"} icon={Droplet} />
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
