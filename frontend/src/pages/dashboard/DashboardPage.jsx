import { Construction } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/common/PageHeader";
import Card from "../../components/common/Card";
import DashboardMonthlySummary from "../../components/attendance/summary/DashboardMonthlySummary";

/**
 * Post-login landing page. Sections appear by permission; the first one is this
 * month's overtime and attendance (AAS-457). The rest of Module 6 (giveaways,
 * inventory, generator alerts, ...) is still to come.
 */
export default function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const showSummary = hasPermission("attendance.read");

  return (
    <>
      <PageHeader title="Dashboard" description={user?.name ? `Welcome back, ${user.name}.` : undefined} />
      <div className="flex flex-col gap-8">
        {showSummary && <DashboardMonthlySummary />}
        <Card className="flex items-center gap-3 text-body text-ink-muted">
          <span className="h-9 w-9 shrink-0 rounded-full bg-surface-blue flex items-center justify-center">
            <Construction className="h-4 w-4 text-primary" />
          </span>
          More dashboard sections (giveaways, inventory, generator alerts) arrive with Module 6 — Centralized
          Dashboard.
        </Card>
      </div>
    </>
  );
}
