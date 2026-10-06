import { useCallback, useEffect, useState } from "react";
import { Wallet, TrendingUp } from "lucide-react";
import StatCard from "../../components/common/StatCard";
import FilterBar from "../../components/common/FilterBar";
import Select from "../../components/common/Select";
import MonthPicker from "../../components/common/MonthPicker";
import Table from "../../components/tables/Table";
import { generatorService } from "../../services/generatorService";
import { formatNumber } from "../../utils/formatNumber";
import { formatHoursMinutes } from "../../utils/hoursMinutes";
import { fuelUnit } from "../../utils/fuelUnit";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const COLUMNS = [
  { key: "generator", header: "Generator", render: (row) => <span className="font-medium text-ink">{row.generator.tag}</span> },
  { key: "fuelCostTotal", header: "Fuel Cost", render: (row) => formatNumber(row.fuelCostTotal) },
  { key: "fuelAddedLiters", header: "Fuel Added", render: (row) => `${formatNumber(row.fuelAddedLiters)} ${fuelUnit(row.generator.fuelType)}` },
  { key: "hoursRun", header: "Hours Run", render: (row) => formatHoursMinutes(row.hoursRun) },
  { key: "averageCostPerHour", header: "Avg Cost / Hour", render: (row) => formatNumber(row.averageCostPerHour) },
  { key: "logCount", header: "Log Entries", render: (row) => row.logCount },
];

/**
 * Spec 4.2's "fuel cost" report — total spend per generator for a chosen
 * calendar month (defaults to the current one), plus the average cost per
 * running hour (0 rather than a divide-by-zero when nothing was run). Hours
 * run — not litres/kg bought — is the basis so diesel/petrol and CNG
 * generators are directly comparable on one measure.
 */
export default function GeneratorReportFuelCost({ generatorOptions }) {
  const [generatorId, setGeneratorId] = useState("");
  const [month, setMonth] = useState("");

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await generatorService.getFuelCostReport({
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
            <MonthPicker label="Month" id="fuel-cost-filter-month" className="sm:w-40" clearable value={month} onChange={setMonth} />
          </>
        }
        onReset={generatorId || month ? handleReset : undefined}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard label={`Total Fuel Cost — ${periodLabel}`} value={report ? formatNumber(report.totalFuelCost) : "—"} icon={Wallet} />
        <StatCard label="Average Cost / Hour" value={report ? formatNumber(report.averageCostPerHour) : "—"} icon={TrendingUp} />
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
