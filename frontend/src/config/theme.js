// Centralized design tokens.
// Tailwind classes should be preferred in JSX, but anything that needs a raw
// hex value (Recharts, inline SVG, canvas) must read from here — never
// hardcode a color in a component.

export const colors = {
  primary: "#2563EB",
  primaryDark: "#1E3A8A",
  primaryLight: "#3B82F6",
  lightBlue: "#EFF6FF",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  textPrimary: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#64748B",
  border: "#E2E8F0",
  success: "#16A34A",
  warning: "#F59E0B",
  error: "#DC2626",
  info: "#0EA5E9",
};

// Ordered palette for multi-series charts (bars/lines/pies).
export const chartPalette = [
  colors.primary,
  colors.info,
  colors.primaryDark,
  colors.success,
  colors.warning,
  colors.error,
];

// Canonical status -> visual style mapping used by the Badge component.
// Add new statuses here rather than inline in a page.
export const statusStyles = {
  present: { label: "Present", color: colors.success, bg: "#F0FDF4" },
  active: { label: "Active", color: colors.success, bg: "#F0FDF4" },
  approved: { label: "Approved", color: colors.success, bg: "#F0FDF4" },
  paid: { label: "Paid", color: colors.success, bg: "#F0FDF4" },
  running: { label: "Running", color: colors.success, bg: "#F0FDF4" },
  inStock: { label: "In Stock", color: colors.success, bg: "#F0FDF4" },

  pending: { label: "Pending", color: colors.warning, bg: "#FFFBEB" },
  halfDay: { label: "Half Day", color: colors.warning, bg: "#FFFBEB" },
  late: { label: "Late", color: colors.warning, bg: "#FFFBEB" },
  lowStock: { label: "Low Stock", color: colors.warning, bg: "#FFFBEB" },
  maintenance: { label: "Maintenance", color: colors.warning, bg: "#FFFBEB" },
  onLeave: { label: "On Leave", color: colors.warning, bg: "#FFFBEB" },

  absent: { label: "Absent", color: colors.error, bg: "#FEF2F2" },
  rejected: { label: "Rejected", color: colors.error, bg: "#FEF2F2" },
  unpaid: { label: "Unpaid", color: colors.error, bg: "#FEF2F2" },
  stopped: { label: "Stopped", color: colors.error, bg: "#FEF2F2" },
  outOfStock: { label: "Out of Stock", color: colors.error, bg: "#FEF2F2" },
  inactive: { label: "Inactive", color: colors.error, bg: "#FEF2F2" },

  info: { label: "Info", color: colors.info, bg: "#F0F9FF" },
  weekend: { label: "Weekend", color: colors.textMuted, bg: "#F8FAFC" },
  holiday: { label: "Holiday", color: colors.info, bg: "#F0F9FF" },
};

export const layout = {
  sidebarWidth: 260,
  sidebarCollapsedWidth: 76,
  headerHeight: 64,
};
