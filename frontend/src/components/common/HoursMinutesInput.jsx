import clsx from "clsx";
import { toHoursMinutes, fromHoursMinutes } from "../../utils/hoursMinutes";

/**
 * Two linked number boxes (Hours / Minutes) standing in for a single decimal-
 * hours value. `value` is the decimal-hours string the rest of the form
 * already works with (same convention as a plain number `Input`); `onChange`
 * fires with the recombined decimal-hours string on every keystroke in
 * either box, so the parent's single source of truth never drifts.
 *
 * Both boxes are always derived from `value` (not their own independent
 * state), so an external change to `value` (e.g. the form resetting) is
 * reflected immediately. Typing 75 into minutes isn't rejected — it carries
 * over into hours on the next render (75m -> 1h 15m), the same way a clock
 * would, since the two boxes are really just one combined value.
 */
export default function HoursMinutesInput({ id, label, required, value, onChange, error, helperText, disabled, className }) {
  const { h, m } = toHoursMinutes(value);

  const emit = (nextH, nextM) => onChange(fromHoursMinutes({ h: nextH, m: nextM }));

  const hoursId = id ? `${id}-hours` : undefined;
  const minutesId = id ? `${id}-minutes` : undefined;

  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      {label && (
        <span className="text-body font-medium text-ink-secondary">
          {label}
          {required && <span className="text-status-error ml-0.5">*</span>}
        </span>
      )}
      <div className="flex gap-2">
        <div className="flex-1">
          <label htmlFor={hoursId} className="sr-only">
            {label ? `${label} — hours` : "Hours"}
          </label>
          <input
            id={hoursId}
            type="number"
            step="1"
            disabled={disabled}
            value={h}
            placeholder="Hours"
            onChange={(e) => emit(e.target.value, m)}
            className={clsx(
              "w-full h-10 rounded-md border bg-white px-3 text-sm text-ink placeholder:text-ink-muted transition-colors duration-150",
              "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
              error ? "border-status-error" : "border-border",
              disabled && "bg-surface-subtle text-ink-muted cursor-not-allowed"
            )}
          />
        </div>
        <div className="flex-1">
          <label htmlFor={minutesId} className="sr-only">
            {label ? `${label} — minutes` : "Minutes"}
          </label>
          <input
            id={minutesId}
            type="number"
            step="1"
            min="0"
            max="59"
            disabled={disabled}
            value={m}
            placeholder="Minutes"
            onChange={(e) => emit(h, e.target.value)}
            className={clsx(
              "w-full h-10 rounded-md border bg-white px-3 text-sm text-ink placeholder:text-ink-muted transition-colors duration-150",
              "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
              error ? "border-status-error" : "border-border",
              disabled && "bg-surface-subtle text-ink-muted cursor-not-allowed"
            )}
          />
        </div>
      </div>
      {error ? (
        <p className="text-helper text-status-error">{error}</p>
      ) : helperText ? (
        <p className="text-helper text-ink-muted">{helperText}</p>
      ) : null}
    </div>
  );
}
