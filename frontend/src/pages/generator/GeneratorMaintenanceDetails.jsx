import { Paperclip } from "lucide-react";
import Modal from "../../components/modals/Modal";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import { formatDate } from "../../utils/formatDate";
import { formatNumber } from "../../utils/formatNumber";
import { formatHoursMinutes } from "../../utils/hoursMinutes";
import { DueInfo } from "./DueInfo";

function recurrenceText(job) {
  const parts = [];
  if (job.intervalDays) parts.push(`Every ${job.intervalDays} day${job.intervalDays === 1 ? "" : "s"}`);
  if (job.intervalHours) parts.push(`every ${formatHoursMinutes(job.intervalHours)} of running`);
  return parts.length ? parts.join(", ") : "One-off (does not repeat)";
}

/**
 * Read-only view of one maintenance job: schedule/recurrence, who did the
 * work and what it cost, and a summary of its invoice. Managing the invoice
 * itself (upload/replace/remove) stays in GeneratorMaintenanceInvoice —
 * "Manage" here just opens that, the same way GeneratorDetails hands off to
 * GeneratorForm for editing rather than editing inline.
 */
export default function GeneratorMaintenanceDetails({ open, onClose, job, onManageInvoice }) {
  if (!job) return null;

  return (
    <Modal open={open} onClose={onClose} title={job.description} description={job.generator?.tag} size="lg">
      <div className="flex flex-col gap-6">
        <section className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <DetailField label="Status" value={<Badge status={job.status === "scheduled" ? job.alertStatus : job.status} />} />
          <DetailField label="Type" value={<span className="capitalize">{job.type}</span>} />
          <DetailField
            label="Scheduled Date"
            value={
              <>
                {formatDate(job.scheduledDate)}
                <DueInfo row={job} />
              </>
            }
          />
          <DetailField label="Recurrence" value={recurrenceText(job)} />
          <DetailField label="Completed Date" value={formatDate(job.completedDate)} />
          <DetailField label="Generator's Hours at Service" value={job.hoursAtService != null ? formatHoursMinutes(job.hoursAtService) : "—"} />
          <DetailField label="Technician" value={job.performedBy || "—"} />
          <DetailField label="Vendor" value={job.vendor || "—"} />
          <DetailField label="Cost" value={formatNumber(job.cost)} />
          <DetailField label="Parts Replaced" value={job.partsReplaced || "—"} />
        </section>

        <section>
          <SectionHeading>Invoice</SectionHeading>
          <div className="flex items-center justify-between bg-surface-subtle rounded-md px-3 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <Paperclip className="h-4 w-4 text-ink-muted shrink-0" />
              <span className="text-body text-ink truncate">{job.invoice?.fileName || "No invoice attached"}</span>
            </div>
            <Button variant="secondary" size="sm" onClick={() => onManageInvoice(job)}>
              {job.invoice ? "Manage" : "Upload"}
            </Button>
          </div>
        </section>

        {job.notes && (
          <section>
            <SectionHeading>Notes</SectionHeading>
            <p className="text-body text-ink-secondary whitespace-pre-wrap">{job.notes}</p>
          </section>
        )}
      </div>
    </Modal>
  );
}

function DetailField({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-helper text-ink-muted uppercase tracking-wide">{label}</span>
      <span className="text-body text-ink">{value}</span>
    </div>
  );
}

function SectionHeading({ children }) {
  return <h3 className="text-card-heading text-ink mb-2">{children}</h3>;
}
