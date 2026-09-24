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

// Single source of truth for sidebar navigation. Add a module here and it
// appears in the sidebar automatically.
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
      { label: "Attendance", to: "/attendance", icon: Users },
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

// Sibling pages of the Attendance module, shown as a switcher at the top of each one.
// A section is listed only for users holding its permission.
export const attendanceSections = [
  { label: "Attendance", to: "/attendance", permission: "attendance.read" },
  { label: "Overtime", to: "/attendance/overtime", permission: "overtime.read" },
  { label: "Leave", to: "/attendance/leave", permission: "leave.read" },
];
