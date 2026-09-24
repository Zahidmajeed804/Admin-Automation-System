import clsx from "clsx";

/**
 * Controlled tab bar. `tabs` is [{ id, label }]; render the matching panel
 * yourself with role="tabpanel", id={`panel-${id}`} and aria-labelledby={`tab-${id}`}.
 * Left/Right arrows move between tabs (roving tabindex); Home/End jump to the
 * first/last tab. Not routing-aware: a page whose tabs are URLs (Generator)
 * maps `value`/`onChange` to the route itself.
 */
export default function Tabs({ tabs, value, onChange, label = "Sections" }) {
  const select = (index) => {
    const next = tabs[index];
    onChange(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  };

  const handleKeyDown = (event, index) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      select((index + 1) % tabs.length);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      select((index - 1 + tabs.length) % tabs.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      select(0);
    } else if (event.key === "End") {
      event.preventDefault();
      select(tabs.length - 1);
    }
  };

  return (
    <div role="tablist" aria-label={label} className="flex gap-1 border-b border-border">
      {tabs.map((tab, index) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={clsx(
              "px-4 py-2.5 -mb-px border-b-2 text-body font-medium whitespace-nowrap transition-colors duration-150",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-t-md",
              selected
                ? "border-primary text-primary"
                : "border-transparent text-ink-secondary hover:text-ink"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
