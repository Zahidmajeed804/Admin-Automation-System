import Badge from "../common/Badge";
import { formatLeaveDate } from "../../utils/leaveFormat";

const plural = (n) => `${n} ${n === 1 ? "day" : "days"}`;

/**
 * The "Days" cell of the leave tables: the current day count, plus an
 * "Edited · was N days" badge when a reviewer changed the dates. Hovering the
 * badge shows the applied dates and who changed them.
 */
export default function LeaveDaysCell({ request }) {
  if (request.originalTotalDays === undefined || request.originalTotalDays === null) {
    return request.totalDays;
  }

  const applied =
    request.originalTotalDays > 1
      ? `${formatLeaveDate(request.originalStartDate)} – ${formatLeaveDate(request.originalEndDate)}`
      : formatLeaveDate(request.originalStartDate);
  const by = request.editedBy?.name ? ` by ${request.editedBy.name}` : "";
  const on = request.editedAt ? ` on ${formatLeaveDate(request.editedAt)}` : "";
  const title = `Applied for ${plural(request.originalTotalDays)}: ${applied}. Dates changed${by}${on}.`;

  return (
    <div className="flex flex-col items-start gap-1">
      <span>{request.totalDays}</span>
      <span title={title}>
        <Badge status="edited" dot={false}>
          Edited · was {plural(request.originalTotalDays)}
        </Badge>
      </span>
    </div>
  );
}
