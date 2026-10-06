import { List, Calendar as CalendarIcon } from "lucide-react";
import clsx from "clsx";

const options = [
  { id: "list", label: "List", icon: List },
  { id: "calendar", label: "Calendar", icon: CalendarIcon },
];

/**
 * Compact List/Calendar segmented switch, used on "My attendance" and on Team Attendance once
 * it's filtered down to one employee (a calendar only makes sense for a single person).
 */
export default function AttendanceViewToggle({ value, onChange }) {
  return (
    <div role="group" aria-label="View" className="inline-flex rounded-md border border-border overflow-hidden shrink-0">
      {options.map((opt, i) => {
        const Icon = opt.icon;
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(opt.id)}
            className={clsx(
              "flex items-center gap-1.5 px-3 h-9 text-body font-medium transition-colors duration-150",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              i > 0 && "border-l border-border",
              selected ? "bg-primary text-white" : "bg-white text-ink-secondary hover:bg-surface-subtle"
            )}
          >
            <Icon className="h-4 w-4" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
