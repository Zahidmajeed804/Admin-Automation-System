import { formatDuration } from "./attendanceFormat";

const pad2 = (n) => String(n).padStart(2, "0");

// "YYYY-MM" of the current month (local time — what the user thinks "this month" is).
export const currentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
};

// "2026-09" -> "September 2026".
export const monthLabel = (key) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString([], { month: "long", year: "numeric" });
};

// The current month and the `count - 1` before it, newest first, for a month picker.
export const monthOptions = (count = 12) => {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    return { value, label: monthLabel(value) };
  });
};

// Minutes -> "2h 30m" / "45m" / "0m".
export const formatMinutes = (minutes) => formatDuration(Math.round(minutes || 0));

// 89.5 -> "89.5%"; null (nothing to measure yet) -> "—".
export const formatPercent = (value) => (value === null || value === undefined ? "—" : `${value}%`);

// Badge colour for an attendance %: green from 90, amber from 75, red below.
export const percentBadgeStatus = (value) => {
  if (value === null || value === undefined) return "weekend";
  if (value >= 90) return "present";
  if (value >= 75) return "late";
  return "absent";
};
