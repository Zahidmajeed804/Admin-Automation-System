import { useCallback, useEffect, useState } from "react";
import { DollarSign, Fuel, Wrench } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Card from "../../components/common/Card";
import StatCard from "../../components/common/StatCard";
import FilterBar from "../../components/common/FilterBar";
import Select from "../../components/common/Select";
import EmptyState from "../../components/common/EmptyState";
import ErrorState from "../../components/common/ErrorState";
import { LoadingSpinner } from "../../components/common/Loading";
import { generatorService } from "../../services/generatorService";
import { formatNumber } from "../../utils/formatNumber";

const CURRENT_YEAR = new Date().getUTCFullYear();
// Same range as GeneratorReportOperatingCost's own year picker, for the same reason.
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 4 + i).map((y) => ({ value: String(y), label: String(y) }));

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Chart colors are the theme's actual hex values (tailwind.config.js), since
// recharts' SVG stroke/fill props need real colors, not Tailwind classes.
const CHART_COLORS = {
  fuel: "#2563EB",
  maintenance: "#F59E0B",
  total: "#16A34A",
  grid: "#E2E8F0",
  added: "#3B82F6",
  consumed: "#0EA5E9",
};

/**
 * Spec 4.2's "cost-analysis dashboard" — fuel cost, maintenance cost and
 * their combined total for a chosen year, fleet-wide or for one generator,
 * plus a monthly trend line, a per-generator cost breakdown and a
 * per-generator fuel-consumption breakdown. Three endpoints feed it, all
 * scoped to the same year/generator filter: getOperatingCostReport (totals
 * + monthly trend — it's already the yearly, 12-month-complete endpoint),
 * getCostSummaryReport (per-generator cost split, its % share unused here
 * since the bars already show relative size), and getDieselConsumptionReport
 * (per-generator fuel added/consumed) ranged over the same calendar year.
 */
export default function GeneratorReportCostAnalysis({ generatorOptions }) {
  const [generatorId, setGeneratorId] = useState("");
  const [year, setYear] = useState("");

  const [operating, setOperating] = useState(null);
  const [costSummary, setCostSummary] = useState(null);
  const [dieselConsumption, setDieselConsumption] = useState(null);
  const [loading, setLoading] = useState(true);
  // Only the operating-cost fetch (the totals row + trend chart) gates the
  // page-level error state, matching every other report view's "one fetch,
  // one error state" convention — a cost-summary/diesel-consumption failure
  // on its own just leaves that one chart empty, since the dashboard's core
  // numbers (fuel/maintenance/total cost) are still shown correctly.
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    const resolvedYear = year || String(CURRENT_YEAR);
    // cost-summary and diesel-consumption take an arbitrary from/to range, not
    // a year param like operating-cost, so the same calendar year is spelled
    // out as its own inclusive range for those two calls.
    const yearRange = { from: `${resolvedYear}-01-01`, to: `${resolvedYear}-12-31T23:59:59.999Z` };

    // The three fetches are independent of each other, so they run
    // concurrently; a cost-summary/diesel-consumption failure only empties
    // its own chart, not the whole dashboard (see the `error` state above).
    const [operatingResult, costSummaryResult, dieselResult] = await Promise.allSettled([
      generatorService.getOperatingCostReport({ ...(generatorId ? { generatorId } : {}), ...(year ? { year } : {}) }),
      generatorService.getCostSummaryReport({ ...(generatorId ? { generatorId } : {}), ...yearRange }),
      generatorService.getDieselConsumptionReport({ ...(generatorId ? { generatorId } : {}), ...yearRange }),
    ]);
    if (operatingResult.status === "fulfilled") {
      setOperating(operatingResult.value);
    } else {
      setOperating(null);
      setError(true);
    }
    setCostSummary(costSummaryResult.status === "fulfilled" ? costSummaryResult.value : null);
    setDieselConsumption(dieselResult.status === "fulfilled" ? dieselResult.value : null);
    setLoading(false);
  }, [generatorId, year]);

  useEffect(() => {
    load();
  }, [load]);

  const handleReset = () => {
    setGeneratorId("");
    setYear("");
  };

  const trendData = (operating?.months ?? []).map((m) => ({
    name: MONTH_SHORT[m.month - 1],
    fuelCost: m.fuelCost,
    maintenanceCost: m.maintenanceCost,
    operatingCost: m.operatingCost,
  }));

  const generatorCostData = (costSummary?.generators ?? []).map((row) => ({
    name: row.generator.tag,
    fuelCost: row.fuelCost,
    maintenanceCost: row.maintenanceCost,
  }));

  const consumptionData = (dieselConsumption?.generators ?? []).map((row) => ({
    name: row.generator.tag,
    fuelAddedLiters: row.fuelAddedLiters,
    fuelConsumedLiters: row.fuelConsumedLiters,
  }));

  // "No generators" (not "no activity this year") is the dashboard's empty
  // state, matching every other report view's own emptyTitle/emptyDescription
  // — a generator with zero cost/consumption for the year still shows up in
  // the charts at 0, same as the table-based reports show it at 0.
  const isEmpty = !loading && !error && (costSummary?.generators.length ?? 0) === 0;

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

      {loading && (
        <Card>
          <LoadingSpinner label="Loading cost analysis…" />
        </Card>
      )}

      {!loading && error && (
        <Card>
          <ErrorState onRetry={load} description="We couldn't load the cost-analysis dashboard. Please try again." />
        </Card>
      )}

      {isEmpty && (
        <Card>
          <EmptyState title="No generators to report on" description="There are no active generators for this filter." />
        </Card>
      )}

      {!loading && !error && !isEmpty && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label={`Fuel Cost — ${operating?.year ?? "—"}`} value={operating ? formatNumber(operating.totalFuelCost) : "—"} icon={Fuel} />
            <StatCard label={`Maintenance Cost — ${operating?.year ?? "—"}`} value={operating ? formatNumber(operating.totalMaintenanceCost) : "—"} icon={Wrench} />
            <StatCard label={`Total Operating Cost — ${operating?.year ?? "—"}`} value={operating ? formatNumber(operating.totalOperatingCost) : "—"} icon={DollarSign} />
          </div>

          <Card>
            <p className="text-card-heading text-ink mb-4">Monthly Cost Trend — {operating?.year ?? "—"}</p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748B" }} axisLine={{ stroke: CHART_COLORS.grid }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#64748B" }} axisLine={false} tickLine={false} width={70} tickFormatter={(v) => formatNumber(v)} />
                  <Tooltip formatter={(value) => formatNumber(value)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="fuelCost" name="Fuel Cost" stroke={CHART_COLORS.fuel} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="maintenanceCost" name="Maintenance Cost" stroke={CHART_COLORS.maintenance} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="operatingCost" name="Total Operating Cost" stroke={CHART_COLORS.total} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <p className="text-card-heading text-ink mb-4">Cost by Generator — {operating?.year ?? "—"}</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={generatorCostData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748B" }} axisLine={{ stroke: CHART_COLORS.grid }} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "#64748B" }} axisLine={false} tickLine={false} width={70} tickFormatter={(v) => formatNumber(v)} />
                    <Tooltip formatter={(value) => formatNumber(value)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="fuelCost" stackId="cost" name="Fuel Cost" fill={CHART_COLORS.fuel} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="maintenanceCost" stackId="cost" name="Maintenance Cost" fill={CHART_COLORS.maintenance} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <p className="text-card-heading text-ink mb-4">Fuel Consumption by Generator — {operating?.year ?? "—"}</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={consumptionData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748B" }} axisLine={{ stroke: CHART_COLORS.grid }} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "#64748B" }} axisLine={false} tickLine={false} width={70} tickFormatter={(v) => formatNumber(v)} />
                    <Tooltip formatter={(value) => `${formatNumber(value)} L`} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="fuelAddedLiters" name="Fuel Added (L)" fill={CHART_COLORS.added} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="fuelConsumedLiters" name="Fuel Consumed (L)" fill={CHART_COLORS.consumed} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
