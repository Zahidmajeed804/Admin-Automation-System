import {
  LayoutDashboard,
  Gift,
  ShoppingBasket,
  Zap,
  Users,
  FileBarChart,
  Bell,
  Settings,
} from "lucide-react";

// The Attendance module's pages, shown as a switcher at the top of each one (the sidebar
// only lists "Attendance"). A page is listed only for users holding its permission.
// `end` stops "/attendance" from also matching /attendance/overtime.
export const attendanceNav = [
  { label: "Attendance", to: "/attendance", permission: "attendance.read", end: true },
  { label: "Overtime", to: "/attendance/overtime", permission: "overtime.read" },
  { label: "Leave", to: "/attendance/leave", permission: "leave.read" },
];

// Single source of truth for sidebar navigation. Add a module here and it
// appears in the sidebar automatically. Items with a `permission` are hidden from users without it.
export const navSections = [
  {
    items: [{ label: "Dashboard", to: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Management",
    items: [
      { label: "Giveaways", to: "/giveaways", icon: Gift },
      { label: "Grocery & Cleaning", to: "/inventory", icon: ShoppingBasket },
      { label: "Generator", to: "/generator", icon: Zap },
      // Stays highlighted on /attendance/overtime and /attendance/leave too (no `end`).
      { label: "Attendance", to: "/attendance", icon: Users, permission: "attendance.read" },
    ],
  },
  {
    items: [
      { label: "Reports", to: "/reports", icon: FileBarChart },
      { label: "Notifications", to: "/notifications", icon: Bell },
      { label: "Settings", to: "/settings", icon: Settings },
    ],
  },
];
