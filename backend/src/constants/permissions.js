// This is seed DATA (what permissions exist in the system), not authorization
// logic. The authorization decision itself always comes from the database
// via rbacRepository.resolvePermissionNamesForUser — never from this list
// directly at request time.
//
// Format: resource.action. Add a module's permissions here when its
// migration/seed is written; middleware/requirePermission just checks
// whether the resolved set contains the given string.

export const permissionsCatalog = [
  // RBAC administration
  { resource: "users", action: "read", description: "View users" },
  { resource: "users", action: "manage", description: "Create/update/deactivate users" },
  { resource: "roles", action: "manage", description: "Create/update roles and assign permissions" },

  // Giveaways (Module 2)
  { resource: "giveaways", action: "read", description: "View giveaway items and inventory" },
  { resource: "giveaways", action: "create", description: "Add giveaway items" },
  { resource: "giveaways", action: "update", description: "Edit giveaway items" },
  { resource: "giveaways", action: "delete", description: "Delete/deactivate giveaway items" },
  { resource: "giveaways", action: "issue", description: "Issue/distribute giveaway stock" },

  // Grocery & Cleaning Inventory (Module 3)
  { resource: "inventory", action: "read", description: "View grocery/cleaning inventory" },
  { resource: "inventory", action: "create", description: "Add inventory items" },
  { resource: "inventory", action: "update", description: "Edit inventory items" },
  { resource: "inventory", action: "delete", description: "Delete inventory items" },
  { resource: "inventory", action: "purchase", description: "Record purchases" },

  // Generator (Module 4)
  { resource: "generator", action: "read", description: "View generators, logs, maintenance" },
  { resource: "generator", action: "create", description: "Add generators/logs/maintenance records" },
  { resource: "generator", action: "update", description: "Edit generator records" },
  { resource: "generator", action: "delete", description: "Delete generator records" },

  // Attendance / Overtime / Leave (Module 5)
  { resource: "attendance", action: "read", description: "View attendance records" },
  { resource: "attendance", action: "create", description: "Record attendance" },
  { resource: "attendance", action: "update", description: "Edit attendance records" },
  { resource: "attendance", action: "approve", description: "Approve attendance corrections" },
  { resource: "overtime", action: "read", description: "View overtime records" },
  { resource: "overtime", action: "approve", description: "Approve/reject overtime" },
  { resource: "leave", action: "read", description: "View leave requests" },
  { resource: "leave", action: "create", description: "Submit leave requests" },
  { resource: "leave", action: "approve", description: "Approve leave requests" },
  { resource: "leave", action: "reject", description: "Reject leave requests" },

  // Reports & Dashboard
  { resource: "dashboard", action: "read", description: "View centralized dashboard" },
  { resource: "reports", action: "read", description: "View/export reports" },
];

// Default roles and the permission names each one starts with.
// This is also seed data — new roles/permissions can be added purely by
// changing the database later; nothing here is read at authorization time.
export const defaultRoles = [
  {
    name: "admin",
    description: "Full system access",
    isSystem: true,
    permissions: permissionsCatalog.map((p) => `${p.resource}.${p.action}`),
  },
  {
    name: "manager",
    description: "Manages inventory, generator, and approves attendance/leave/overtime",
    isSystem: true,
    permissions: [
      "giveaways.read", "giveaways.create", "giveaways.update", "giveaways.issue",
      "inventory.read", "inventory.create", "inventory.update", "inventory.purchase",
      "generator.read", "generator.create", "generator.update",
      "attendance.read", "attendance.create", "attendance.update", "attendance.approve",
      "overtime.read", "overtime.approve",
      "leave.read", "leave.approve", "leave.reject",
      "dashboard.read", "reports.read",
    ],
  },
  {
    name: "staff",
    description: "Basic operational access",
    isSystem: true,
    permissions: [
      "giveaways.read",
      "inventory.read",
      "generator.read",
      "attendance.read", "attendance.create",
      "overtime.read",
      "leave.read", "leave.create",
      "dashboard.read",
    ],
  },
];
