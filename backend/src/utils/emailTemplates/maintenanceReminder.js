// Builds the daily maintenance-reminder digest email: one message per
// recipient listing every overdue/upcoming job, rather than one email per
// job — a generator with several jobs due doesn't spam the inbox, and the
// counts match what the maintenance page's stat cards already show.

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// Mirrors the frontend's dueInLine (DueInfo.jsx): negative means overdue.
function dueInWords(value, unit) {
  if (value === undefined || value === null) return null;
  const rounded = Math.round(Math.abs(value));
  return value < 0 ? `overdue by ${rounded}${unit}` : `due in ${rounded}${unit}`;
}

function dueSummary(job) {
  const parts = [dueInWords(job.daysUntilDue, "d"), dueInWords(job.hoursUntilDue, "h")].filter(Boolean);
  return parts.length ? parts.join(", ") : "";
}

function generatorLabel(job) {
  if (!job.generator) return "(deleted generator)";
  return job.generator.name ? `${job.generator.tag} — ${job.generator.name}` : job.generator.tag;
}

function rowsToText(jobs) {
  return jobs
    .map((j) => `  - ${generatorLabel(j)}: ${j.description} (scheduled ${formatDate(j.scheduledDate)}, ${dueSummary(j)})`)
    .join("\n");
}

function rowsToHtml(jobs, color) {
  return jobs
    .map(
      (j) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${generatorLabel(j)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${j.description}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${formatDate(j.scheduledDate)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;color:${color};font-weight:600;">${dueSummary(j)}</td>
      </tr>`
    )
    .join("");
}

function section(title, jobs, color) {
  if (!jobs.length) return "";
  return `
    <h3 style="color:${color};margin:20px 0 8px;">${title} (${jobs.length})</h3>
    <table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:14px;">
      <thead>
        <tr style="text-align:left;background:#f3f4f6;">
          <th style="padding:6px 10px;">Generator</th>
          <th style="padding:6px 10px;">Job</th>
          <th style="padding:6px 10px;">Scheduled</th>
          <th style="padding:6px 10px;">Status</th>
        </tr>
      </thead>
      <tbody>${rowsToHtml(jobs, color)}</tbody>
    </table>`;
}

/**
 * `overdue` and `upcoming` are the arrays getMaintenanceAlerts() already
 * returns (each item has generator/description/scheduledDate/daysUntilDue/
 * hoursUntilDue). Returns null if there is nothing to report, so callers
 * know not to send anything.
 */
export function buildMaintenanceReminderEmail({ overdue = [], upcoming = [] } = {}) {
  if (!overdue.length && !upcoming.length) return null;

  const subjectParts = [];
  if (overdue.length) subjectParts.push(`${overdue.length} overdue`);
  if (upcoming.length) subjectParts.push(`${upcoming.length} upcoming`);
  const subject = `Generator maintenance alert: ${subjectParts.join(", ")}`;

  const text = [
    "Generator maintenance alert",
    "",
    overdue.length ? `Overdue (${overdue.length}):\n${rowsToText(overdue)}` : "",
    upcoming.length ? `Upcoming (${upcoming.length}):\n${rowsToText(upcoming)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const html = `
    <div style="font-family:Arial,sans-serif;color:#111827;">
      <h2 style="margin:0 0 4px;">Generator maintenance alert</h2>
      <p style="color:#6b7280;margin:0 0 12px;">Daily summary of maintenance jobs needing attention.</p>
      ${section("Overdue", overdue, "#dc2626")}
      ${section("Upcoming", upcoming, "#d97706")}
    </div>`;

  return { subject, html, text };
}
