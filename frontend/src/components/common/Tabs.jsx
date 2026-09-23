import { useRef } from "react";
import clsx from "clsx";

/**
 * Generic controlled tab strip. Not routing-aware — pages that need each
 * tab to be its own URL (e.g. Generator's registry/logs/maintenance) wire
 * `value`/`onChange` to useLocation/useNavigate themselves; a page that
 * just wants to switch between local views can use plain useState instead.
 *
 * `tabs` is [{ value, label }]. Follows the WAI-ARIA tabs pattern: arrow
 * keys move focus and select, Home/End jump to the first/last tab.
 */
export default function Tabs({ tabs, value, onChange, className }) {
  const tabRefs = useRef([]);

  const focusAndSelect = (index) => {
    const tab = tabs[index];
    tabRefs.current[index]?.focus();
    onChange(tab.value);
  };

  const handleKeyDown = (event, index) => {
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        focusAndSelect((index + 1) % tabs.length);
        break;
      case "ArrowLeft":
        event.preventDefault();
        focusAndSelect((index - 1 + tabs.length) % tabs.length);
        break;
      case "Home":
        event.preventDefault();
        focusAndSelect(0);
        break;
      case "End":
        event.preventDefault();
        focusAndSelect(tabs.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div role="tablist" className={clsx("flex items-center gap-1 border-b border-border", className)}>
      {tabs.map((tab, index) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            ref={(el) => (tabRefs.current[index] = el)}
            role="tab"
            type="button"
            id={`tab-${tab.value}`}
            aria-selected={selected}
            aria-controls={`tabpanel-${tab.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={clsx(
              "px-4 py-2.5 text-body font-medium border-b-2 -mb-px transition-colors duration-150",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-t-md",
              selected
                ? "border-primary text-primary"
                : "border-transparent text-ink-muted hover:text-ink-secondary"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
