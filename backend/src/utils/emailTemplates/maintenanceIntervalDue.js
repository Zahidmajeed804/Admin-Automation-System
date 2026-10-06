// Builds the one-off email sent when a generator's running hours since its
// last service reach its configured maintenanceIntervalHours. Unlike the
// daily digest (maintenanceReminder.js, keyed off scheduled maintenance
// jobs), this is a single-generator, single-send notification —
// generatorService.recordLog() sends it once per crossing, and
// generatorService.completeMaintenance() resetting the interval lets it
// fire again next time.

import { formatHoursMinutes } from "../hoursMinutes.js";

function generatorLabel(generator) {
  return generator.name ? `${generator.tag} — ${generator.name}` : generator.tag;
}

export function buildMaintenanceIntervalDueEmail(generator) {
  const hoursSinceReset = formatHoursMinutes(generator.runningHoursTotal - (generator.hoursAtLastMaintenanceReset || 0));
  const interval = formatHoursMinutes(generator.maintenanceIntervalHours);
  const label = generatorLabel(generator);
  const subject = `Generator maintenance due: ${label}`;

  const text = `${label} has run ${hoursSinceReset} since its last service, reaching its ${interval} maintenance interval. Schedule a service to clear this.`;

  const html = `
    <div style="font-family:Arial,sans-serif;color:#111827;">
      <h2 style="margin:0 0 4px;">Generator maintenance due</h2>
      <p style="margin:0 0 12px;"><strong>${label}</strong> has run <strong>${hoursSinceReset}</strong> since its last service, reaching its <strong>${interval}</strong> maintenance interval.</p>
      <p style="color:#6b7280;margin:0;">Schedule a service for this generator to clear the alert.</p>
    </div>`;

  return { subject, html, text };
}
