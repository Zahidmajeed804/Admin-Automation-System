import { forwardRef } from "react";
import clsx from "clsx";

/**
 * Shared text input. Handles label, required marker, helper text, and
 * error state so forms don't reimplement this per module.
 */
const Input = forwardRef(function Input(
  { label, id, error, helperText, required, className, icon: Icon, trailing, ...rest },
  ref
) {
  const inputId = id || rest.name;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-body font-medium text-ink-secondary"
        >
          {label}
          {required && <span className="text-status-error ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
        )}
        <input
          id={inputId}
          ref={ref}
          className={clsx(
            "w-full h-10 rounded-md border bg-white px-3 text-sm text-ink placeholder:text-ink-muted transition-colors duration-150",
            "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
            Icon && "pl-9",
            trailing && "pr-9",
            error ? "border-status-error" : "border-border",
            rest.disabled && "bg-surface-subtle text-ink-muted cursor-not-allowed",
            className
          )}
          {...rest}
        />
        {trailing && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">{trailing}</span>
        )}
      </div>
      {error ? (
        <p className="text-helper text-status-error">{error}</p>
      ) : helperText ? (
        <p className="text-helper text-ink-muted">{helperText}</p>
      ) : null}
    </div>
  );
});

export default Input;
