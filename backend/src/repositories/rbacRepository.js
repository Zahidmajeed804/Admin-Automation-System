import { Role, Permission, UserRole, RolePermission } from "../models/index.js";

export const rbacRepository = {
  // Roles
  findAllRoles: () => Role.find().sort({ name: 1 }),
  findRoleByName: (name) => Role.findOne({ name }),
  findRoleById: (id) => Role.findById(id),
  createRole: (data) => Role.create(data),

  // Permissions
  findAllPermissions: () => Permission.find().sort({ resource: 1, action: 1 }),
  findPermissionByName: (name) => Permission.findOne({ name }),
  createPermission: (data) => Permission.create(data),

  // User <-> Role
  assignRoleToUser: (userId, roleId) =>
    UserRole.findOneAndUpdate(
      { user: userId, role: roleId },
      { user: userId, role: roleId },
      { upsert: true, returnDocument: "after" }
    ),
  removeRoleFromUser: (userId, roleId) => UserRole.deleteOne({ user: userId, role: roleId }),
  findRolesForUser: async (userId) => {
    const links = await UserRole.find({ user: userId }).populate("role");
    return links.map((l) => l.role).filter(Boolean);
  },

  // Role <-> Permission
  assignPermissionToRole: (roleId, permissionId) =>
    RolePermission.findOneAndUpdate(
      { role: roleId, permission: permissionId },
      { role: roleId, permission: permissionId },
      { upsert: true, returnDocument: "after" }
    ),
  removePermissionFromRole: (roleId, permissionId) =>
    RolePermission.deleteOne({ role: roleId, permission: permissionId }),
  findPermissionsForRoleIds: async (roleIds) => {
    if (!roleIds.length) return [];
    const links = await RolePermission.find({ role: { $in: roleIds } }).populate("permission");
    return links.map((l) => l.permission).filter(Boolean);
  },

  /**
   * Full resolution chain: User -> UserRoles -> Roles -> RolePermissions -> Permissions.
   * Returns a de-duplicated array of permission name strings, e.g. ["giveaways.create", ...].
   * This is the ONLY place that walks the RBAC graph — authorization middleware
   * and the frontend /auth/me response both go through this function.
   */
  resolvePermissionNamesForUser: async (userId) => {
    const roles = await rbacRepository.findRolesForUser(userId);
    const roleIds = roles.map((r) => r._id);
    const permissions = await rbacRepository.findPermissionsForRoleIds(roleIds);
    const names = new Set(permissions.map((p) => p.name));
    return { roleNames: roles.map((r) => r.name), permissionNames: Array.from(names) };
  },
};
