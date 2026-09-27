import { useCallback, useEffect, useState } from "react";
import { DollarSign, Fuel, Wrench } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Card from "../../components/common/Card";
import StatCard from "../../components/common/StatCard";
import FilterBar from "../../components/common/FilterBar";
import Select from "../../components/common/Select";
import { generatorService } from "../../services/generatorService";
import { formatNumber } from "../../utils/formatNumber";

const CURRENT_YEAR = new Date().getUTCFullYear();
// Same range as GeneratorReportOperatingCost's own year picker, for the same reason.
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 4 + i).map((y) => ({ value: String(y), label: String(y) }));

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Chart colors are the theme's actual hex values (tailwind.config.js), since
// recharts' SVG stroke/fill props need real colors, not Tailwind classes.
const CHART_COLORS = { fuel: "#2563EB", maintenance: "#F59E0B", total: "#16A34A", grid: "#E2E8F0" };

/**
 * Spec 4.2's "cost-analysis dashboard" — fuel cost, maintenance cost and
 * their combined total for a chosen year, fleet-wide or for one generator.
 * Reuses getOperatingCostReport for these totals and for the monthly trend
 * chart below them, since it's already the yearly, 12-month-complete
 * endpoint spec 4.2 asks for. The per-generator breakdown/consumption
 * charts (AAS-369) come next.
 */
export default function GeneratorReportCostAnalysis({ generatorOptions }) {
  const [generatorId, setGeneratorId] = useState("");
  const [year, setYear] = useState("");

  const [operating, setOperating] = useState(null);

  // Loading/error handling for this whole dashboard (the totals row here,
  // plus the trend and breakdown charts still to come) lands together in
  // AAS-370 once all three report fetches exist — the StatCards below just
  // show "—" until the first response arrives.
  const load = useCallback(async () => {
    try {
      const data = await generatorService.getOperatingCostReport({
        ...(generatorId ? { generatorId } : {}),
        ...(year ? { year } : {}),
      });
      setOperating(data);
    } catch {
      setOperating(null);
    }
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
    </div>
  );
}
