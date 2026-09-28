import { useEffect, useRef, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { toDateStr, parseDateStr, buildMonthGrid, monthLabel, WEEKDAYS } from "./DatePicker";

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

/**
 * Same popover calendar as DatePicker, plus hour/minute selects for minute-precision time. Value
 * and onChange are "YYYY-MM-DDTHH:mm" strings, matching <input type="datetime-local">. Like
 * DatePicker, picking a day or a time only stages it: OK commits via onChange, Cancel, Escape and
 * a click outside discard it.
 */
export default function DateTimePicker({ label, id, value, onChange, min, max, error, helperText, required, className }) {
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(null);
  const [draftHour, setDraftHour] = useState("00");
  const [draftMinute, setDraftMinute] = useState("00");
  const [view, setView] = useState(null);
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
    const now = new Date();
    const { date, hour, minute } = splitValue(value);
    const start = parseDateStr(date) || now;
    setDraftDate(toDateStr(start));
    setDraftHour(hour || pad2(now.getHours()));
    setDraftMinute(minute || pad2(now.getMinutes()));
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
    setOpen(false);
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
        <span className="truncate">{value ? displayLabel(value) : "Select date and time"}</span>
        <CalendarIcon className="h-4 w-4 text-ink-muted shrink-0" />
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
          aria-label="Choose a date and time"
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
              const selected = s === draftDate;
              const isToday = s === todayStr;
              const disabled = isDisabled(day);
              return (
                <button
                  key={s}
                  type="button"
                  disabled={disabled}
                  onClick={() => setDraftDate(s)}
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
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <span className="text-helper text-ink-muted">Time</span>
            <select
              aria-label="Hour"
              value={draftHour}
              onChange={(e) => setDraftHour(e.target.value)}
              className="h-8 rounded-md border border-border bg-white px-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              {hourOptions.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <span className="text-ink-muted">:</span>
            <select
              aria-label="Minute"
              value={draftMinute}
              onChange={(e) => setDraftMinute(e.target.value)}
              className="h-8 rounded-md border border-border bg-white px-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
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
              onClick={() => setOpen(false)}
              className="h-8 px-3 rounded-md text-sm font-medium text-ink-secondary hover:bg-surface-subtle transition-colors duration-150"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={commit}
              disabled={!draftDate}
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
