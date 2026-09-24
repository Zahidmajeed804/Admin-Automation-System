import { useState } from "react";
import { MoreVertical } from "lucide-react";

/**
 * Row-level "⋮" actions dropdown used in table Actions columns.
 * items: [{ icon?, label, onClick, danger? }]
 *
 * The menu is positioned with `fixed` so it isn't clipped by the table's
 * overflow container.
 */
export default function ActionMenu({ items = [] }) {
  const [position, setPosition] = useState(null);

  if (items.length === 0) return null;

  const toggle = (e) => {
    if (position) {
      setPosition(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label="Row actions"
        className="h-8 w-8 rounded-md flex items-center justify-center text-ink-muted hover:bg-surface-subtle"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {position && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setPosition(null)} />
          <div
            style={{ top: position.top, right: position.right }}
            className="fixed w-44 bg-white border border-border rounded-md shadow-elevated z-20 py-1.5"
          >
            {items.map(({ icon: Icon, label, onClick, danger }) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setPosition(null);
                  onClick?.();
                }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-body hover:bg-surface-subtle ${
                  danger ? "text-status-error hover:bg-status-errorBg" : "text-ink-secondary"
                }`}
              >
                {Icon && <Icon className="h-4 w-4" />} {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
