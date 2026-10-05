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
import { fuelUnit } from "../../utils/fuelUnit";

const COLUMNS = [
  { key: "generator", header: "Generator", render: (row) => <span className="font-medium text-ink">{row.generator.tag}</span> },
  { key: "fuelAddedLiters", header: "Fuel Added", render: (row) => `${formatNumber(row.fuelAddedLiters)} ${fuelUnit(row.generator.fuelType)}` },
  { key: "fuelConsumedLiters", header: "Fuel Consumed", render: (row) => `${formatNumber(row.fuelConsumedLiters)} ${fuelUnit(row.generator.fuelType)}` },
  { key: "logCount", header: "Log Entries", render: (row) => row.logCount },
];

/**
 * Spec 4.2's "diesel consumption" report, widened to cover CNG — additions
 * and consumption per generator over an arbitrary date range (defaults to
 * "this month so far", matching the backend). Diesel/petrol generators are
 * litres, CNG generators are kg; the two are never added together, so the
 * fleet totals show as two separate stat-card pairs. Opening/closing
 * readings are per-log detail already shown on the Fuel & Usage Logs tab,
 * not repeated here.
 */
export default function GeneratorReportFuelConsumption({ generatorOptions }) {
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
      const data = await generatorService.getFuelConsumptionReport({
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
            <Input type="date" aria-label="From date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" aria-label="To date" value={to} onChange={(e) => setTo(e.target.value)} />
          </>
        }
        onReset={generatorId || from || to ? handleReset : undefined}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={`Fuel Added (L) — ${rangeLabel}`} value={report ? `${formatNumber(report.totalFuelAddedLiters)} L` : "—"} icon={Fuel} />
        <StatCard label={`Fuel Consumed (L) — ${rangeLabel}`} value={report ? `${formatNumber(report.totalFuelConsumedLiters)} L` : "—"} icon={Droplet} />
        <StatCard label={`Fuel Added (kg) — ${rangeLabel}`} value={report ? `${formatNumber(report.totalFuelAddedKg)} kg` : "—"} icon={Fuel} />
        <StatCard label={`Fuel Consumed (kg) — ${rangeLabel}`} value={report ? `${formatNumber(report.totalFuelConsumedKg)} kg` : "—"} icon={Droplet} />
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
