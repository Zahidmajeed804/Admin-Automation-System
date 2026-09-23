import { useCallback, useEffect, useState } from "react";
import Modal from "../../components/modals/Modal";
import Badge from "../../components/common/Badge";
import { LoadingSpinner } from "../../components/common/Loading";
import ErrorState from "../../components/common/ErrorState";
import { generatorService } from "../../services/generatorService";

const RECENT_LOGS_COUNT = 5;

// No date-formatting utility exists in the codebase yet — this is the
// first page to need one. Kept local rather than extracted, since it's
// one line; worth promoting to a shared helper once a second page
// (Logs/Maintenance, S2.3/S2.4) needs the same formatting.
const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—");

/**
 * Read-only detail view for one generator: its specs, its most recent
 * usage logs, and its next scheduled maintenance. Stands in for a
 * separate /generator/:id route/page, which the backlog deliberately
 * skips in favor of this modal.
 */
export default function GeneratorDetails({ open, onClose, generator }) {
  const [logs, setLogs] = useState([]);
  const [nextMaintenance, setNextMaintenance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(
    async (signal) => {
      if (!generator) return;
      setLoading(true);
      setError(false);
      try {
        const [logsRes, maintenanceRes] = await Promise.all([
          generatorService.listLogs({ generatorId: generator._id, pageSize: RECENT_LOGS_COUNT }),
          generatorService.listMaintenance({ generatorId: generator._id, status: "scheduled", pageSize: 1 }),
        ]);
        if (signal?.cancelled) return;
        setLogs(logsRes.items);
        // status=scheduled is returned soonest-due first, so item 0 is the next one.
        setNextMaintenance(maintenanceRes.items[0] ?? null);
      } catch {
        if (!signal?.cancelled) setError(true);
      } finally {
        if (!signal?.cancelled) setLoading(false);
      }
    },
    [generator]
  );

  useEffect(() => {
    if (!open || !generator) return;
    const signal = { cancelled: false };
    load(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [open, generator, load]);

  if (!generator) return null;

  return (
    <Modal open={open} onClose={onClose} title={generator.name} description={generator.tag} size="lg">
      <div className="flex flex-col gap-6">
        <section className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <DetailField label="Status" value={<Badge status={generator.status} />} />
          <DetailField label="Location" value={generator.location || "—"} />
          <DetailField label="Make / Model" value={[generator.make, generator.model].filter(Boolean).join(" / ") || "—"} />
          <DetailField label="Serial Number" value={generator.serialNumber || "—"} />
          <DetailField label="Capacity" value={generator.capacityKVA != null ? `${generator.capacityKVA} kVA` : "—"} />
          <DetailField label="Fuel" value={`${generator.fuelType}${generator.fuelTankCapacityLiters != null ? ` · ${generator.fuelTankCapacityLiters} L tank` : ""}`} />
          <DetailField label="Running Hours" value={generator.runningHoursTotal.toFixed(1)} />
          <DetailField label="Last Service" value={formatDate(generator.lastServiceDate)} />
          <DetailField label="Installed" value={formatDate(generator.installationDate)} />
        </section>

        {generator.notes && (
          <section>
            <SectionHeading>Notes</SectionHeading>
            <p className="text-body text-ink-secondary whitespace-pre-wrap">{generator.notes}</p>
          </section>
        )}

        {loading && <LoadingSpinner label="Loading recent activity…" />}
        {!loading && error && (
          <ErrorState description="Couldn't load recent logs and maintenance." onRetry={() => load()} />
        )}

        {!loading && !error && (
          <>
            <section>
              <SectionHeading>Next Maintenance</SectionHeading>
              {nextMaintenance ? (
                <div className="flex items-center justify-between bg-surface-subtle rounded-md px-3 py-2.5">
                  <div>
                    <p className="text-body text-ink font-medium">{nextMaintenance.description}</p>
                    <p className="text-helper text-ink-muted">Due {formatDate(nextMaintenance.scheduledDate)}</p>
                  </div>
                  <Badge status={nextMaintenance.alertStatus} />
                </div>
              ) : (
                <p className="text-body text-ink-muted">Nothing scheduled.</p>
              )}
            </section>

            <section>
              <SectionHeading>Recent Logs</SectionHeading>
              {logs.length === 0 ? (
                <p className="text-body text-ink-muted">No usage logs recorded yet.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {logs.map((log) => (
                    <li key={log._id} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-body text-ink">
                          {log.hoursRun}h{log.reason ? ` — ${log.reason}` : ""}
                        </p>
                        <p className="text-helper text-ink-muted">{formatDate(log.date)}</p>
                      </div>
                      {log.fuelAddedLiters > 0 && (
                        <span className="text-helper text-ink-muted">+{log.fuelAddedLiters} L</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
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
