import OvertimeShareChart from "./OvertimeShareChart";
import AttendanceBreakdownChart from "./AttendanceBreakdownChart";

/**
 * The summary's charts side by side: the overtime-share pie always, plus the
 * attendance-breakdown pie when the summary is down to one person
 * (`singleRow`). Default export so callers can React.lazy() it and keep recharts
 * out of the main bundle.
 */
export default function SummaryCharts({ staff, singleRow }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <OvertimeShareChart staff={staff} />
      {singleRow && <AttendanceBreakdownChart row={singleRow} />}
    </div>
  );
}
