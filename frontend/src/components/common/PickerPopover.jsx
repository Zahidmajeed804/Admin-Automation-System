import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

const GAP = 4; // px between the field and the popover
const EDGE = 8; // px kept clear of the viewport edges

/**
 * Floating panel for DatePicker / DateTimePicker. Rendered into <body> with fixed positioning
 * so a scrolling container (a Modal body, a table wrapper) can't clip it or make you scroll to
 * reach it. Opens below `anchorRef`, flips above when there's more room there, and stays inside
 * the viewport; it follows the field while anything scrolls or resizes.
 */
export default function PickerPopover({ anchorRef, popoverRef, label, onKeyDown, children }) {
  const [position, setPosition] = useState(null);

  useLayoutEffect(() => {
    const place = () => {
      const anchor = anchorRef.current;
      const popover = popoverRef.current;
      if (!anchor || !popover) return;
      const a = anchor.getBoundingClientRect();
      const width = popover.offsetWidth;
      const height = popover.offsetHeight;
      const spaceBelow = window.innerHeight - a.bottom - GAP - EDGE;
      const spaceAbove = a.top - GAP - EDGE;
      const top = height <= spaceBelow || spaceBelow >= spaceAbove ? a.bottom + GAP : a.top - GAP - height;
      setPosition({
        top: Math.max(EDGE, Math.min(top, window.innerHeight - EDGE - height)),
        left: Math.max(EDGE, Math.min(a.left, window.innerWidth - EDGE - width)),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    // The calendar grows by a row in six-week months.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    observer?.observe(popoverRef.current);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      observer?.disconnect();
    };
  }, [anchorRef, popoverRef]);

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onKeyDown={onKeyDown}
      // Transparent until measured so it never flashes at the top-left corner. Not visibility:hidden:
      // the picker focuses a day as it opens, and a hidden element can't take focus.
      // z-[60] sits above Modal (z-50).
      style={position ? { top: position.top, left: position.left } : { top: 0, left: 0, opacity: 0 }}
      className="fixed z-[60] w-72 max-w-[calc(100vw-2rem)] bg-white rounded-card border border-border shadow-elevated p-3 flex flex-col gap-3"
    >
      {children}
    </div>,
    document.body
  );
}
