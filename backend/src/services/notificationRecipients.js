import { rbacRepository } from "../repositories/rbacRepository.js";

// Reuses generator.update — maintenance still has no permissions of its own
// (same gap noted since S2.5/S2.9: maintenance rides on the generator ones).
// Anyone who can edit generators is someone who'd act on a maintenance alert.
export const MAINTENANCE_ALERT_PERMISSION = "generator.update";

/**
 * Email addresses for the daily maintenance reminder: active users holding
 * MAINTENANCE_ALERT_PERMISSION, de-duplicated. A deactivated account or one
 * missing an email (shouldn't happen — email is required on User — but kept
 * defensive) is silently skipped rather than failing the whole job.
 */
export async function getMaintenanceReminderRecipients() {
  const users = await rbacRepository.findUsersWithPermission(MAINTENANCE_ALERT_PERMISSION);
  return users.filter((u) => u.isActive && u.email).map((u) => u.email);
}
