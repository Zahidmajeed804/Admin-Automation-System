import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Button from "../../common/Button";
import { LoadingSpinner } from "../../common/Loading";
import MonthlySummaryStats from "./MonthlySummaryStats";
import useMonthlySummary from "./useMonthlySummary";
import { currentMonthKey, monthLabel } from "../../../utils/summaryFormat";

// recharts only loads once the dashboard has data to chart.
const OvertimeShareChart = lazy(() => import("./OvertimeShareChart"));

/**
 * Compact "this month" block for the Dashboard: the three summary stat cards and
 * the overtime-share pie, with a link to Attendance › Summary for the full table and
 * filters. The API scopes it: managers see everyone, others see their own month.
 */
export default function DashboardMonthlySummary() {
  const month = currentMonthKey();
  const { summary, loading, failed, retry } = useMonthlySummary({ month });

  return (
    <section className="flex flex-col gap-4" data-section="monthly-summary" aria-labelledby="dashboard-summary-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="dashboard-summary-heading" className="text-section-heading text-ink">
            Overtime &amp; attendance
          </h2>
          <p className="text-helper text-ink-muted">{monthLabel(month)} so far</p>
        </div>
        <Link
          to="/attendance/summary"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark"
        >
          View full summary <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      {failed ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 bg-status-errorBg border border-red-200 text-status-error text-body rounded-md px-3 py-2"
        >
          Couldn&apos;t load this month&apos;s summary.
          <Button variant="secondary" size="sm" onClick={retry}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          <MonthlySummaryStats totals={summary?.totals} loading={loading} />
          {summary && !loading && (
            <Suspense fallback={<LoadingSpinner label="Loading chart…" />}>
              <div className="lg:max-w-2xl">
                <OvertimeShareChart staff={summary.staff} />
              </div>
            </Suspense>
          )}
        </>
      )}
    </section>
  );
}
