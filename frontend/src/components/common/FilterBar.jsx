import { RotateCcw } from "lucide-react";
import SearchInput from "./SearchInput";
import Button from "./Button";

/**
 * Consistent row of search + filter controls above tables.
 * `filters` accepts arbitrary already-built control elements (Select, DatePicker, etc.)
 * so each module decides which filters it needs while keeping the layout identical.
 */
export default function FilterBar({ search, onSearchChange, searchPlaceholder, filters, onReset, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-wrap">
      {/* items-end, not items-center: filter controls that have a visible label above
          their input (e.g. DatePicker) are taller than a label-less one (e.g. a bare
          Select using only a placeholder) — centering the row left their input boxes
          sitting at different heights, so the bottom edge is what actually lines up. */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
        {onSearchChange && (
          <SearchInput value={search} onChange={onSearchChange} placeholder={searchPlaceholder} />
        )}
        {filters}
        {onReset && (
          <Button variant="ghost" size="sm" icon={RotateCcw} onClick={onReset}>
            Reset
          </Button>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
