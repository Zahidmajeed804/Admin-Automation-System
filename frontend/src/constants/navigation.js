import {
  LayoutDashboard,
  Gift,
  ShoppingBasket,
  Zap,
  Users,
  Timer,
  CalendarDays,
  FileBarChart,
  Bell,
  Settings,
} from "lucide-react";

// The Attendance module's pages. One list feeds both the sidebar and the switcher at the top of
// each page, so labels, paths and permissions can't drift apart. An item is shown only to users
// holding its permission. `end` stops "/attendance" from also matching /attendance/overtime.
export const attendanceNav = [
  { label: "Attendance", to: "/attendance", icon: Users, permission: "attendance.read", end: true },
  { label: "Overtime", to: "/attendance/overtime", icon: Timer, permission: "overtime.read" },
  { label: "Leave", to: "/attendance/leave", icon: CalendarDays, permission: "leave.read" },
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
      ...attendanceNav,
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
