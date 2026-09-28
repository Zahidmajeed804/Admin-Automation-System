import { useEffect, useRef, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import clsx from "clsx";

export const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const pad2 = (n) => String(n).padStart(2, "0");

// "YYYY-MM-DD" <-> a local Date, without ever going through `new Date(string)` (which parses
// as UTC and can shift a day in negative-UTC timezones). Matches the plain-string semantics of
// <input type="date"> and the API's own date strings.
export const toDateStr = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const parseDateStr = (s) => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

export const monthLabel = (year, month) =>
  new Date(year, month, 1).toLocaleDateString([], { month: "long", year: "numeric" });

const displayLabel = (s) => {
  const d = parseDateStr(s);
  return d ? d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) : "";
};

// One month's cells for a Sun-Sat grid, padded with leading/trailing `null`s to a multiple of 7
// so the grid height doesn't jump between months.
export function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/**
 * Button-styled field (looks like Input) that opens a popover calendar. Value and onChange are
 * plain "YYYY-MM-DD" strings, matching <input type="date">, so it drops into existing forms and
 * filters. Clicking a day only stages a selection: OK commits it via onChange, Cancel, Escape and
 * a click outside discard it and reopening starts from the current value again (or today, if
 * there isn't one).
 */
export default function DatePicker({
  label,
  id,
  value,
  onChange,
  min,
  max,
  error,
  helperText,
  required,
  clearable,
  placeholder = "Select date",
  className,
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null); // staged "YYYY-MM-DD", only meaningful while open
  const [view, setView] = useState(null); // { year, month } currently shown
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const openPicker = () => {
    const start = parseDateStr(value) || new Date();
    setDraft(toDateStr(start));
    setView({ year: start.getFullYear(), month: start.getMonth() });
    setOpen(true);
  };

  const changeMonth = (delta) => {
    setView(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const isDisabled = (day) => {
    const s = toDateStr(day);
    if (min && s < min) return true;
    if (max && s > max) return true;
    return false;
  };

  const commit = () => {
    onChange(draft || "");
    setOpen(false);
  };

  const clear = (e) => {
    e.stopPropagation();
    onChange("");
  };

  const todayStr = toDateStr(new Date());
  const grid = view ? buildMonthGrid(view.year, view.month) : [];

  return (
    <div className={clsx("flex flex-col gap-1.5 relative", className)} ref={wrapperRef}>
      {label && (
        <label htmlFor={id} className="text-body font-medium text-ink-secondary">
          {label}
          {required && <span className="text-status-error ml-0.5">*</span>}
        </label>
      )}
      <button
        type="button"
        id={id}
        onClick={() => (open ? setOpen(false) : openPicker())}
        className={clsx(
          "w-full h-10 rounded-md border bg-white px-3 text-sm text-left transition-colors duration-150 flex items-center justify-between gap-2",
          "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
          error ? "border-status-error" : "border-border",
          value ? "text-ink" : "text-ink-muted"
        )}
      >
        <span className="truncate">{value ? displayLabel(value) : placeholder}</span>
        <span className="flex items-center gap-1.5 shrink-0">
          {clearable && value && (
            <X className="h-3.5 w-3.5 text-ink-muted hover:text-ink" onClick={clear} aria-label="Clear date" />
          )}
          <CalendarIcon className="h-4 w-4 text-ink-muted" />
        </span>
      </button>
      {error ? (
        <p className="text-helper text-status-error">{error}</p>
      ) : helperText ? (
        <p className="text-helper text-ink-muted">{helperText}</p>
      ) : null}

      {open && view && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Choose a date"
          className="absolute z-20 top-full mt-1 left-0 w-72 bg-white rounded-card border border-border shadow-elevated p-3 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => changeMonth(-1)}
              className="h-8 w-8 rounded-md flex items-center justify-center text-ink-muted hover:bg-surface-subtle hover:text-ink transition-colors duration-150"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-body font-medium text-ink">{monthLabel(view.year, view.month)}</span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => changeMonth(1)}
              className="h-8 w-8 rounded-md flex items-center justify-center text-ink-muted hover:bg-surface-subtle hover:text-ink transition-colors duration-150"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((w) => (
              <span key={w} className="text-helper text-ink-muted font-medium py-1">
                {w}
              </span>
            ))}
            {grid.map((day, i) => {
              if (!day) return <span key={i} />;
              const s = toDateStr(day);
              const selected = s === draft;
              const isToday = s === todayStr;
              const disabled = isDisabled(day);
              return (
                <button
                  key={s}
                  type="button"
                  disabled={disabled}
                  onClick={() => setDraft(s)}
                  className={clsx(
                    "h-8 w-8 mx-auto rounded-full text-sm transition-colors duration-150",
                    disabled && "text-ink-muted/50 cursor-not-allowed",
                    !disabled && !selected && "text-ink hover:bg-surface-subtle",
                    selected && "bg-primary text-white font-medium",
                    !selected && isToday && "ring-1 ring-primary"
                  )}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-border">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-8 px-3 rounded-md text-sm font-medium text-ink-secondary hover:bg-surface-subtle transition-colors duration-150"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={commit}
              disabled={!draft}
              className="h-8 px-3 rounded-md text-sm font-medium bg-primary text-white hover:bg-primary-dark disabled:bg-blue-300 transition-colors duration-150"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
