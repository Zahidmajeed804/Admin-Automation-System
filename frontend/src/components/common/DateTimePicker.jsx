import { useEffect, useRef, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { toDateStr, parseDateStr, buildMonthGrid, monthLabel, addDays, addMonthsClamped, addYears, WEEKDAYS } from "./DatePicker";

const pad2 = (n) => String(n).padStart(2, "0");

// "YYYY-MM-DDTHH:mm" -> parts, matching <input type="datetime-local"> and
// utils/attendanceFormat.js's toDateTimeLocalValue, so this drops into the same forms.
const splitValue = (v) => {
  if (!v) return { date: "", hour: "", minute: "" };
  const [datePart, timePart = ""] = v.split("T");
  const [hour = "", minute = ""] = timePart.split(":");
  return { date: datePart, hour, minute };
};

const displayLabel = (v) => {
  const { date, hour, minute } = splitValue(v);
  const d = parseDateStr(date);
  if (!d || hour === "" || minute === "") return "";
  const dateStr = d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
  const timeStr = new Date(2000, 0, 1, Number(hour), Number(minute)).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${dateStr}, ${timeStr}`;
};

const hourOptions = Array.from({ length: 24 }, (_, h) => pad2(h));
const minuteOptions = Array.from({ length: 60 }, (_, m) => pad2(m));

const toWeeks = (cells) => {
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
};

/**
 * Same popover calendar as DatePicker, plus hour/minute selects for minute-precision time. Value
 * and onChange are "YYYY-MM-DDTHH:mm" strings, matching <input type="datetime-local">. Like
 * DatePicker, picking a day or a time only stages it: OK commits via onChange, Cancel, Escape and
 * a click outside discard it. Keyboard/ARIA/mobile behavior mirrors DatePicker (see there); the
 * Hour and Minute selects join the trapped Tab order after the day grid.
 */
export default function DateTimePicker({ label, id, value, onChange, min, max, error, helperText, required, className }) {
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(null);
  const [draftHour, setDraftHour] = useState("00");
  const [draftMinute, setDraftMinute] = useState("00");
  const [view, setView] = useState(null);
  const [focused, setFocused] = useState(null); // "YYYY-MM-DD" of the roving-tabindex day
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const prevMonthRef = useRef(null);
  const nextMonthRef = useRef(null);
  const hourRef = useRef(null);
  const minuteRef = useRef(null);
  const cancelRef = useRef(null);
  const okRef = useRef(null);

  const close = () => {
    setOpen(false);
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

  useEffect(() => {
    if (!open || !focused) return;
    popoverRef.current?.querySelector(`[data-date="${focused}"]`)?.focus();
  }, [open, focused, view]);

  const openPicker = () => {
    const now = new Date();
    const { date, hour, minute } = splitValue(value);
    const start = parseDateStr(date) || now;
    const startStr = toDateStr(start);
    setDraftDate(startStr);
    setDraftHour(hour || pad2(now.getHours()));
    setDraftMinute(minute || pad2(now.getMinutes()));
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

  // min/max are full "YYYY-MM-DDTHH:mm" strings; days are disabled by their date part only,
  // the hour/minute selects always stay open (there's no per-minute grid to grey out).
  const isDisabled = (day) => {
    const s = toDateStr(day);
    if (min && s < min.slice(0, 10)) return true;
    if (max && s > max.slice(0, 10)) return true;
    return false;
  };

  const draft = draftDate ? `${draftDate}T${draftHour}:${draftMinute}` : null;

  const commit = () => {
    onChange(draft || "");
    close();
  };

  const moveFocus = (next) => {
    if (isDisabled(next)) return;
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
        // Enter is the same as OK: stage the focused day and commit the whole date+time.
        e.preventDefault();
        if (!isDisabled(current)) {
          setDraftDate(focused);
          onChange(`${focused}T${draftHour}:${draftMinute}`);
          close();
        }
        return;
      default:
        return;
    }
  };

  // Traps Tab inside the popover: Prev month -> Next month -> the one focusable day -> Hour ->
  // Minute -> Cancel -> OK -> (wraps back to Prev month), and the reverse with Shift+Tab.
  const onPopoverKeyDown = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== "Tab") return;
    const focusedDayEl = popoverRef.current?.querySelector('[tabindex="0"]');
    const order = [
      prevMonthRef.current,
      nextMonthRef.current,
      focusedDayEl,
      hourRef.current,
      minuteRef.current,
      cancelRef.current,
      okRef.current,
    ].filter(Boolean);
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
            "w-full h-10 rounded-md border bg-white pl-3 pr-9 text-sm text-left transition-colors duration-150 flex items-center",
            "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
            error ? "border-status-error" : "border-border",
            value ? "text-ink" : "text-ink-muted"
          )}
        >
          <span className="truncate">{value ? displayLabel(value) : "Select date and time"}</span>
        </button>
        <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
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
          aria-label="Choose a date and time"
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
                    const selected = s === draftDate;
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
                          setDraftDate(s);
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
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <span className="text-helper text-ink-muted">Time</span>
            <select
              ref={hourRef}
              aria-label="Hour"
              value={draftHour}
              onChange={(e) => setDraftHour(e.target.value)}
              className="h-9 sm:h-8 rounded-md border border-border bg-white px-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              {hourOptions.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <span className="text-ink-muted">:</span>
            <select
              ref={minuteRef}
              aria-label="Minute"
              value={draftMinute}
              onChange={(e) => setDraftMinute(e.target.value)}
              className="h-9 sm:h-8 rounded-md border border-border bg-white px-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              {minuteOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-end gap-2">
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
              disabled={!draftDate}
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
