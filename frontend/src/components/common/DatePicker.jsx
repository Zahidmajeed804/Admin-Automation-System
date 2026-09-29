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

// Deliberately "DD/MM/YYYY" via manual padding rather than toLocaleDateString: a locale-dependent
// month name (e.g. "16 Sept 2026") is long enough to get clipped by the trigger's fixed width in
// every place it's used at a narrow size (filter bars' `sm:w-40`), especially once the clear
// button's reserved space is added on top - this stays compact and predictable at any width.
const displayLabel = (s) => {
  const d = parseDateStr(s);
  return d ? `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}` : "";
};

export const addDays = (d, n) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

// Adds whole months, clamping the day so e.g. 31 Jan + 1 month lands on 28/29 Feb instead of
// rolling into March (the native Date behavior for "set month" overflow).
export const addMonthsClamped = (d, n) => {
  const targetMonth = d.getMonth() + n;
  const daysInTarget = new Date(d.getFullYear(), targetMonth + 1, 0).getDate();
  return new Date(d.getFullYear(), targetMonth, Math.min(d.getDate(), daysInTarget));
};

export const addYears = (d, n) => addMonthsClamped(d, n * 12);

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

// Chunks a flat 42-cell grid into 6 week-rows of 7, for ARIA role="row" grouping.
const toWeeks = (cells) => {
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
};

/**
 * Button-styled field (looks like Input) that opens a popover calendar. Value and onChange are
 * plain "YYYY-MM-DD" strings, matching <input type="date">, so it drops into existing forms and
 * filters. Clicking a day only stages a selection: OK commits it via onChange, Cancel, Escape and
 * a click outside discard it and reopening starts from the current value again (or today, if
 * there isn't one).
 *
 * Keyboard: arrow keys move focus a day/week at a time, Home/End jump to the start/end of the
 * week, PageUp/PageDown change month (with Shift, year), Enter commits the focused day (same as
 * OK) and Space stages it without closing, matching a native <button>. Tab is trapped inside the
 * popover while it's open and focus returns to the field when it closes, however it closes.
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
  const [focused, setFocused] = useState(null); // "YYYY-MM-DD" of the roving-tabindex day
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const prevMonthRef = useRef(null);
  const nextMonthRef = useRef(null);
  const cancelRef = useRef(null);
  const okRef = useRef(null);

  const close = () => {
    setOpen(false);
    // Popover unmounts immediately; give focus somewhere sane instead of losing it to <body>.
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) close();
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  // Moves real DOM focus onto the roving-tabindex day whenever it (or the visible month) changes.
  useEffect(() => {
    if (!open || !focused) return;
    popoverRef.current?.querySelector(`[data-date="${focused}"]`)?.focus();
  }, [open, focused, view]);

  const openPicker = () => {
    const start = parseDateStr(value) || new Date();
    const startStr = toDateStr(start);
    setDraft(startStr);
    setFocused(startStr);
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
    close();
  };

  const clear = () => onChange("");

  const moveFocus = (next) => {
    if (isDisabled(next)) return; // a disabled day can't be focused (it isn't tabbable), so stop short
    setFocused(toDateStr(next));
    setView({ year: next.getFullYear(), month: next.getMonth() });
  };

  const onGridKeyDown = (e) => {
    if (!focused) return;
    const current = parseDateStr(focused);
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        moveFocus(addDays(current, 1));
        return;
      case "ArrowLeft":
        e.preventDefault();
        moveFocus(addDays(current, -1));
        return;
      case "ArrowDown":
        e.preventDefault();
        moveFocus(addDays(current, 7));
        return;
      case "ArrowUp":
        e.preventDefault();
        moveFocus(addDays(current, -7));
        return;
      case "Home":
        e.preventDefault();
        moveFocus(addDays(current, -current.getDay()));
        return;
      case "End":
        e.preventDefault();
        moveFocus(addDays(current, 6 - current.getDay()));
        return;
      case "PageUp":
        e.preventDefault();
        moveFocus(e.shiftKey ? addYears(current, -1) : addMonthsClamped(current, -1));
        return;
      case "PageDown":
        e.preventDefault();
        moveFocus(e.shiftKey ? addYears(current, 1) : addMonthsClamped(current, 1));
        return;
      case "Enter":
        // Enter is the same as OK: commit the focused day immediately, don't just stage it.
        e.preventDefault();
        if (!isDisabled(current)) {
          onChange(focused);
          close();
        }
        return;
      default:
        return;
    }
  };

  // Handles Escape and traps Tab inside the popover: Prev month -> Next month -> the one
  // focusable day -> Cancel -> OK -> (wraps back to Prev month), and the reverse with Shift+Tab.
  // Escape is handled here (bubbling up from a focused element inside the popover) rather than
  // with a document-level listener, specifically so stopPropagation can keep it from also
  // reaching an enclosing Modal's own Escape handler and closing that too.
  const onPopoverKeyDown = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== "Tab") return;
    const focusedDayEl = popoverRef.current?.querySelector('[tabindex="0"]');
    const order = [prevMonthRef.current, nextMonthRef.current, focusedDayEl, cancelRef.current, okRef.current].filter(
      Boolean
    );
    const activeIndex = order.indexOf(document.activeElement);
    if (activeIndex === -1) return;
    e.preventDefault();
    const nextIndex = e.shiftKey
      ? (activeIndex - 1 + order.length) % order.length
      : (activeIndex + 1) % order.length;
    order[nextIndex]?.focus();
  };

  const todayStr = toDateStr(new Date());
  const grid = view ? buildMonthGrid(view.year, view.month) : [];
  const weeks = toWeeks(grid);

  return (
    <div className={clsx("flex flex-col gap-1.5 relative", className)} ref={wrapperRef}>
      {label && (
        <label htmlFor={id} className="text-body font-medium text-ink-secondary">
          {label}
          {required && <span className="text-status-error ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          id={id}
          ref={triggerRef}
          onClick={() => (open ? close() : openPicker())}
          className={clsx(
            "w-full h-10 rounded-md border bg-white pl-3 text-sm text-left transition-colors duration-150 flex items-center",
            clearable && value ? "pr-16" : "pr-9",
            "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
            error ? "border-status-error" : "border-border",
            value ? "text-ink" : "text-ink-muted"
          )}
        >
          <span className="truncate">{value ? displayLabel(value) : placeholder}</span>
        </button>
        {/* Siblings of the trigger, not children: a clear control has to be its own <button>, and
            a <button> can't nest another <button> (the browser would silently break the markup). */}
        <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
          {clearable && value && (
            <button
              type="button"
              onClick={clear}
              aria-label="Clear date"
              className="pointer-events-auto h-6 w-6 -m-1 flex items-center justify-center rounded text-ink-muted hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <CalendarIcon className="h-4 w-4 text-ink-muted" />
        </span>
      </div>
      {error ? (
        <p className="text-helper text-status-error">{error}</p>
      ) : helperText ? (
        <p className="text-helper text-ink-muted">{helperText}</p>
      ) : null}

      {open && view && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-modal="true"
          aria-label="Choose a date"
          onKeyDown={onPopoverKeyDown}
          className="absolute z-20 top-full mt-1 left-0 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-card border border-border shadow-elevated p-3 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              ref={prevMonthRef}
              aria-label="Previous month"
              onClick={() => changeMonth(-1)}
              className="h-9 w-9 sm:h-8 sm:w-8 rounded-md flex items-center justify-center text-ink-muted hover:bg-surface-subtle hover:text-ink transition-colors duration-150"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-body font-medium text-ink" aria-live="polite">
              {monthLabel(view.year, view.month)}
            </span>
            <button
              type="button"
              ref={nextMonthRef}
              aria-label="Next month"
              onClick={() => changeMonth(1)}
              className="h-9 w-9 sm:h-8 sm:w-8 rounded-md flex items-center justify-center text-ink-muted hover:bg-surface-subtle hover:text-ink transition-colors duration-150"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div role="grid" aria-label={monthLabel(view.year, view.month)} onKeyDown={onGridKeyDown}>
            <div className="grid grid-cols-7 gap-1 text-center">
              <div role="row" className="contents">
                {WEEKDAYS.map((w) => (
                  <span key={w} role="columnheader" aria-label={w} className="text-helper text-ink-muted font-medium py-1">
                    {w}
                  </span>
                ))}
              </div>
              {weeks.map((week, weekIdx) => (
                <div role="row" className="contents" key={weekIdx}>
                  {week.map((day, i) => {
                    if (!day) return <span key={i} role="gridcell" aria-hidden="true" />;
                    const s = toDateStr(day);
                    const selected = s === draft;
                    const isToday = s === todayStr;
                    const disabled = isDisabled(day);
                    return (
                      <button
                        key={s}
                        type="button"
                        role="gridcell"
                        data-date={s}
                        disabled={disabled}
                        aria-selected={selected}
                        aria-current={isToday ? "date" : undefined}
                        aria-label={day.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                        tabIndex={s === focused ? 0 : -1}
                        onClick={() => {
                          setDraft(s);
                          setFocused(s);
                        }}
                        className={clsx(
                          "h-9 w-9 sm:h-8 sm:w-8 mx-auto rounded-full text-sm transition-colors duration-150",
                          "focus:outline-none focus:ring-2 focus:ring-primary/50",
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
              ))}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-border">
            <button
              type="button"
              ref={cancelRef}
              onClick={close}
              className="h-9 sm:h-8 px-3 rounded-md text-sm font-medium text-ink-secondary hover:bg-surface-subtle transition-colors duration-150"
            >
              Cancel
            </button>
            <button
              type="button"
              ref={okRef}
              onClick={commit}
              disabled={!draft}
              className="h-9 sm:h-8 px-3 rounded-md text-sm font-medium bg-primary text-white hover:bg-primary-dark disabled:bg-blue-300 transition-colors duration-150"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
