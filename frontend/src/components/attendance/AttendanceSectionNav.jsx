import { NavLink } from "react-router-dom";
import clsx from "clsx";
import { useAuth } from "../../context/AuthContext";
import { attendanceSections } from "../../constants/navigation";

/**
 * Switcher between the Attendance, Overtime and Leave pages. Lists only the
 * sections the user may open, and disappears when there is nothing to switch to.
 */
export default function AttendanceSectionNav() {
  const { hasPermission } = useAuth();
  const sections = attendanceSections.filter((s) => hasPermission(s.permission));
  if (sections.length < 2) return null;

  return (
    <nav aria-label="Attendance sections" className="flex flex-wrap gap-1">
      {sections.map((section) => (
        <NavLink
          key={section.to}
          to={section.to}
          // "/attendance" is a prefix of the other two, so match it exactly.
          end={section.to === "/attendance"}
          className={({ isActive }) =>
            clsx(
              "inline-flex items-center h-9 px-3 rounded-md text-body font-medium transition-colors duration-150",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              isActive
                ? "bg-surface-blue text-primary"
                : "text-ink-secondary hover:bg-surface-subtle hover:text-ink"
            )
          }
        >
          {section.label}
        </NavLink>
      ))}
    </nav>
  );
}
