import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { colors } from "../../../config/theme";

/**
 * Donut chart plus a text legend, shared by the summary's two pies. `slices` is
 * [{ name, value, color, display }] in display order; `display` is the formatted
 * value ("2h 30m", "15 days"). Zero-value slices stay in the legend but aren't drawn.
 * The legend carries every name, value and share in text, so colour is never the
 * only way to tell slices apart.
 */
export default function SummaryPie({ slices, chartId, label }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const drawn = slices.filter((s) => s.value > 0);
  const share = (value) => (total ? `${Math.round((value / total) * 100)}%` : "0%");

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4" data-chart={chartId}>
      <div className="h-48 w-full sm:w-48 shrink-0" role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={drawn}
              dataKey="value"
              nameKey="name"
              innerRadius="58%"
              outerRadius="95%"
              // 2px surface gap between slices.
              stroke={colors.surface}
              strokeWidth={2}
              isAnimationActive={false}
            >
              {drawn.map((s) => (
                <Cell key={s.name} fill={s.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name, item) => [`${item.payload.display} (${share(value)})`, name]}
              contentStyle={{ borderRadius: 8, borderColor: colors.border, fontSize: 13 }}
              itemStyle={{ color: colors.textPrimary }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-col gap-2 min-w-0 flex-1">
        {slices.map((s) => (
          <li key={s.name} className="flex items-center gap-2 text-body">
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} aria-hidden="true" />
            <span className="text-ink truncate" title={s.name}>
              {s.name}
            </span>
            <span className="ml-auto text-ink-secondary whitespace-nowrap tabular-nums">
              {s.display} · {share(s.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
