import { RotateCcw } from "lucide-react";
import SearchInput from "./SearchInput";
import Button from "./Button";

/**
 * Consistent row of search + filter controls above tables.
 * `filters` accepts arbitrary already-built control elements (Select, DatePicker, etc.)
 * so each module decides which filters it needs while keeping the layout identical.
 * Controls line up on their bottom edge, so an unlabelled search box, labelled selects and
 * the Reset button all sit on the same line whether or not a filter has a label above it.
 */
export default function FilterBar({ search, onSearchChange, searchPlaceholder, filters, onReset, actions }) {
  // items-end, not items-center: filter controls that have a visible label above
  // their input (e.g. DatePicker) are taller than a label-less one (e.g. a bare
  // Select using only a placeholder) — centering the row left their input boxes
  // sitting at different heights, so the bottom edge is what actually lines up.
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 flex-wrap">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
        {onSearchChange && (
          <SearchInput value={search} onChange={onSearchChange} placeholder={searchPlaceholder} />
        )}
        {filters}
        {onReset && (
          // Same height as the inputs (h-10) so it reads as part of the row, not a floating link.
          <Button variant="ghost" icon={RotateCcw} onClick={onReset}>
            Reset
          </Button>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
