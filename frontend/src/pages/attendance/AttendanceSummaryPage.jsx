import { lazy, Suspense, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { attendanceService } from "../../services/attendanceService";
import { designationService } from "../../services/designationService";
import PageHeader from "../../components/common/PageHeader";
import AttendanceSectionNav from "../../components/attendance/AttendanceSectionNav";
import FilterBar from "../../components/common/FilterBar";
import Select from "../../components/common/Select";
import MonthlySummaryStats from "../../components/attendance/summary/MonthlySummaryStats";
import MonthlySummaryTable from "../../components/attendance/summary/MonthlySummaryTable";
import useMonthlySummary from "../../components/attendance/summary/useMonthlySummary";
import { LoadingSpinner } from "../../components/common/Loading";
import { currentMonthKey, monthLabel, monthOptions } from "../../utils/summaryFormat";

// recharts only loads once the page needs a chart.
const SummaryCharts = lazy(() => import("../../components/attendance/summary/SummaryCharts"));

const noFilters = { month: currentMonthKey(), userId: "", designationId: "" };

/**
 * Attendance › Summary: one month of overtime and attendance per person, with
 * totals. Managers (attendance.update) see all staff and can filter by employee or
 * designation; everyone else sees only their own numbers (the API enforces it too).
 */
export default function AttendanceSummaryPage() {
  const { hasPermission } = useAuth();
  const canViewAll = hasPermission("attendance.update");
  const [filters, setFilters] = useState(noFilters);
  const [employees, setEmployees] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [optionsFailed, setOptionsFailed] = useState(false);
  const { summary, loading, failed, retry } = useMonthlySummary(canViewAll ? filters : { month: filters.month });

  useEffect(() => {
    if (!canViewAll) return;
    let cancelled = false;
    Promise.all([attendanceService.employees(), designationService.list()])
      .then(([people, titles]) => {
        if (cancelled) return;
        setEmployees(people);
        setDesignations(titles);
      })
      .catch(() => {
        if (!cancelled) setOptionsFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [canViewAll]);

  const setFilter = (name) => (e) => setFilters((f) => ({ ...f, [name]: e.target.value }));
  const hasFilters = filters.month !== noFilters.month || Boolean(filters.userId || filters.designationId);

  const employeeOptions = [
    { value: "", label: "All employees" },
    ...employees.map((e) => ({ value: e._id, label: e.isActive === false ? `${e.name} (inactive)` : e.name })),
  ];
  const designationOptions = [
    { value: "", label: "All designations" },
    ...designations.map((d) => ({ value: d._id, label: d.isActive ? d.name : `${d.name} (inactive)` })),
  ];

  return (
    <>
      <PageHeader
        title="Monthly summary"
        description={
          canViewAll
            ? "Overtime and attendance per person for a month, with totals for everyone listed."
            : "Your overtime and attendance for a month."
        }
      />
      <AttendanceSectionNav />
      <div className="flex flex-col gap-6">
        <FilterBar
          onReset={hasFilters ? () => setFilters(noFilters) : undefined}
          filters={
            <>
              <Select
                label="Month"
                name="month"
                id="summary-filter-month"
                className="sm:w-48"
                value={filters.month}
                onChange={setFilter("month")}
                options={monthOptions(12)}
              />
              {canViewAll && (
                <>
                  <Select
                    label="Employee"
                    name="userId"
                    id="summary-filter-employee"
                    className="sm:w-56"
                    value={filters.userId}
                    onChange={setFilter("userId")}
                    options={employeeOptions}
                    helperText={optionsFailed ? "Couldn't load filter options" : undefined}
                  />
                  <Select
                    label="Designation"
                    name="designationId"
                    id="summary-filter-designation"
                    className="sm:w-48"
                    value={filters.designationId}
                    onChange={setFilter("designationId")}
                    options={designationOptions}
                  />
                </>
              )}
            </>
          }
        />
        <MonthlySummaryStats totals={summary?.totals} loading={loading} />
        {summary && !loading && (
          <p className="text-helper text-ink-muted -mt-2">
            {monthLabel(summary.month)}: {summary.workingDays} working day(s) counted so far (Mon–Fri). Attendance % =
            (present + late + ½ half-day) ÷ (working days − approved leave days).
          </p>
        )}
        {summary && !loading && (
          <Suspense fallback={<LoadingSpinner label="Loading charts…" />}>
            <SummaryCharts
              staff={summary.staff}
              // The breakdown pie is for one person: an employee filter, or a staff member's own view.
              singleRow={(!canViewAll || filters.userId) && summary.staff.length === 1 ? summary.staff[0] : null}
            />
          </Suspense>
        )}
        <MonthlySummaryTable
          staff={summary?.staff}
          loading={loading}
          failed={failed}
          onRetry={retry}
          emptyDescription={
            hasFilters
              ? "Try another month, or reset the filters."
              : "Staff appear here once they have a designation or any attendance, overtime or leave this month."
          }
        />
      </div>
    </>
  );
}
