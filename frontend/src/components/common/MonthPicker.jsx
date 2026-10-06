import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import clsx from "clsx";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad2 = (n) => String(n).padStart(2, "0");
const toMonthStr = (year, month) => `${year}-${pad2(month + 1)}`; // month: 0-based
const parseMonthStr = (s) => {
  if (!s) return null;
  const [y, m] = s.split("-").map(Number);
  if (!y || !m) return null;
  return { year: y, month: m - 1 };
};
const displayLabel = (s) => {
  const d = parseMonthStr(s);
  return d ? `${MONTHS_SHORT[d.month]} ${d.year}` : "";
};

/**
 * A month/year equivalent of DatePicker: same button-trigger-opens-a-popover
 * shape, same "YYYY-MM" string value/onChange convention (matching
 * <input type="month">, which this replaces), portaled to <body> for the
 * same reason DatePicker is — so it isn't clipped by a scrollable ancestor.
 * No day grid, so no roving-tabindex/arrow-key day navigation; Tab moves
 * through Prev year -> each month button -> Next year -> Cancel -> OK.
 */
export default function MonthPicker({ label, id, value, onChange, error, helperText, required, clearable, placeholder = "Select month", className }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null); // staged "YYYY-MM", only meaningful while open
  const [viewYear, setViewYear] = useState(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const okRef = useRef(null);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    const onDocMouseDown = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target) && !popoverRef.current?.contains(e.target)) close();
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const POPOVER_WIDTH = 256;
  const POPOVER_HEIGHT_ESTIMATE = 260;
  const updatePosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    let left = rect.left;
    if (left + POPOVER_WIDTH > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - POPOVER_WIDTH - margin);
    }
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < POPOVER_HEIGHT_ESTIMATE && rect.top > POPOVER_HEIGHT_ESTIMATE;
    const top = openUpward ? rect.top - POPOVER_HEIGHT_ESTIMATE - 4 : rect.bottom + 4;
    setPos({ top, left });
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const openPicker = () => {
    const start = parseMonthStr(value) || { year: new Date().getFullYear(), month: new Date().getMonth() };
    setDraft(toMonthStr(start.year, start.month));
    setViewYear(start.year);
    setOpen(true);
  };

  const commit = () => {
    onChange(draft || "");
    close();
  };

  const clear = () => onChange("");

  const onPopoverKeyDown = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
  };

  const id_ = id;

  return (
    <div className={clsx("flex flex-col gap-1.5 relative", className)} ref={wrapperRef}>
      {label && (
        <label htmlFor={id_} className="text-body font-medium text-ink-secondary">
          {label}
          {required && <span className="text-status-error ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          id={id_}
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
        <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
          {clearable && value && (
            <button
              type="button"
              onClick={clear}
              aria-label="Clear month"
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

      {open &&
        viewYear &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-modal="true"
            aria-label="Choose a month"
            onKeyDown={onPopoverKeyDown}
            style={{ top: pos.top, left: pos.left }}
            className="fixed z-[60] w-64 bg-white rounded-card border border-border shadow-elevated p-3 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <button
                type="button"
                aria-label="Previous year"
                onClick={() => setViewYear((y) => y - 1)}
                className="h-9 w-9 sm:h-8 sm:w-8 rounded-md flex items-center justify-center text-ink-muted hover:bg-surface-subtle hover:text-ink transition-colors duration-150"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-body font-medium text-ink" aria-live="polite">
                {viewYear}
              </span>
              <button
                type="button"
                aria-label="Next year"
                onClick={() => setViewYear((y) => y + 1)}
                className="h-9 w-9 sm:h-8 sm:w-8 rounded-md flex items-center justify-center text-ink-muted hover:bg-surface-subtle hover:text-ink transition-colors duration-150"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1.5" role="group" aria-label={`Months in ${viewYear}`}>
              {MONTHS_SHORT.map((m, i) => {
                const s = toMonthStr(viewYear, i);
                const selected = s === draft;
                const isCurrent = s === toMonthStr(new Date().getFullYear(), new Date().getMonth());
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setDraft(s)}
                    className={clsx(
                      "h-9 rounded-md text-sm transition-colors duration-150",
                      "focus:outline-none focus:ring-2 focus:ring-primary/50",
                      !selected && "text-ink hover:bg-surface-subtle",
                      selected && "bg-primary text-white font-medium",
                      !selected && isCurrent && "ring-1 ring-primary"
                    )}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-end gap-2 pt-1 border-t border-border">
              <button
                type="button"
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
          </div>,
          document.body
        )}
    </div>
  );
}

// Exported for tests/reuse, same convention as DatePicker's own exports.
export { toMonthStr, parseMonthStr };
