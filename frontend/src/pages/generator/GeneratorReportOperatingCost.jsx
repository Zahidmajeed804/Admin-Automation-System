import { useCallback, useEffect, useState } from "react";
import { DollarSign, Fuel, Wrench } from "lucide-react";
import StatCard from "../../components/common/StatCard";
import FilterBar from "../../components/common/FilterBar";
import Select from "../../components/common/Select";
import Table from "../../components/tables/Table";
import { generatorService } from "../../services/generatorService";
import { formatNumber } from "../../utils/formatNumber";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CURRENT_YEAR = new Date().getUTCFullYear();
// A handful of years around now — the backend accepts 2000-2100, but a
// generator's real history won't reach back that far.
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 4 + i).map((y) => ({ value: String(y), label: String(y) }));

const COLUMNS = [
  { key: "month", header: "Month", render: (row) => MONTH_NAMES[row.month - 1] },
  { key: "fuelCost", header: "Fuel Cost", render: (row) => formatNumber(row.fuelCost) },
  { key: "maintenanceCost", header: "Maintenance Cost", render: (row) => formatNumber(row.maintenanceCost) },
  { key: "operatingCost", header: "Operating Cost", render: (row) => formatNumber(row.operatingCost) },
];

/**
 * Spec 4.2's "yearly operating cost" report — fuel cost plus maintenance
 * cost combined into a 12-month trend for a chosen year (defaults to the
 * current one), fleet-wide or for one generator. Every month appears even
 * at 0, so the trend has no gaps.
 */
export default function GeneratorReportOperatingCost({ generatorOptions }) {
  const [generatorId, setGeneratorId] = useState("");
  const [year, setYear] = useState("");

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await generatorService.getOperatingCostReport({
        ...(generatorId ? { generatorId } : {}),
        ...(year ? { year } : {}),
      });
      setReport(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [generatorId, year]);

  useEffect(() => {
    load();
  }, [load]);

  const handleReset = () => {
    setGeneratorId("");
    setYear("");
  };

  return (
    <div className="flex flex-col gap-5">
      <FilterBar
        filters={
          <>
            <Select value={generatorId} onChange={(e) => setGeneratorId(e.target.value)} options={generatorOptions} placeholder="All generators" />
            <Select value={year} onChange={(e) => setYear(e.target.value)} options={YEAR_OPTIONS} placeholder={`${CURRENT_YEAR} (current)`} />
          </>
        }
        onReset={generatorId || year ? handleReset : undefined}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label={`Fuel Cost — ${report?.year ?? "—"}`} value={report ? formatNumber(report.totalFuelCost) : "—"} icon={Fuel} />
        <StatCard label={`Maintenance Cost — ${report?.year ?? "—"}`} value={report ? formatNumber(report.totalMaintenanceCost) : "—"} icon={Wrench} />
        <StatCard label={`Total Operating Cost — ${report?.year ?? "—"}`} value={report ? formatNumber(report.totalOperatingCost) : "—"} icon={DollarSign} />
      </div>

      <Table
        columns={COLUMNS}
        data={(report?.months ?? []).map((row) => ({ ...row, id: row.month }))}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="No data for this year"
        emptyDescription="There is no fuel or maintenance activity for this filter."
      />
    </div>
  );
}
