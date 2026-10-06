import { userRepository } from "../repositories/userRepository.js";
import { rbacRepository } from "../repositories/rbacRepository.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { signToken } from "../utils/jwt.js";
import { ConflictError, UnauthorizedError } from "../errors/AppError.js";

const INVALID_LOGIN = "Invalid phone, Employee ID, email or password";

export const authService = {
  async register({ name, email, password, phone, department }) {
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new ConflictError("An account with this email already exists");
    }

    const passwordHash = await hashPassword(password);
    const user = await userRepository.create({ name, email, passwordHash, phone, department });

    // Every new user gets the "staff" role by default so they have some
    // baseline access. Admins can add/remove roles later via the roles API.
    const staffRole = await rbacRepository.findRoleByName("staff");
    if (staffRole) {
      await rbacRepository.assignRoleToUser(user._id, staffRole._id);
    }

    const { roleNames, permissionNames } = await rbacRepository.resolvePermissionNamesForUser(user._id);
    const token = signToken({ sub: user._id.toString() });

    return { user, token, roles: roleNames, permissions: permissionNames };
  },

  // `identifier` is a phone number, Employee ID or email (userRepository.findByIdentifier).
  // One message for every failure, so it never reveals which accounts exist.
  async login({ identifier, password }) {
    const user = await userRepository.findByIdentifier(identifier, true);
    if (!user || !user.isActive) {
      throw new UnauthorizedError(INVALID_LOGIN);
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError(INVALID_LOGIN);
    }

    await userRepository.touchLastLogin(user._id);

    const { roleNames, permissionNames } = await rbacRepository.resolvePermissionNamesForUser(user._id);
    const token = signToken({ sub: user._id.toString() });

    return { user, token, roles: roleNames, permissions: permissionNames };
  },

  async getCurrentUser(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedError("User not found");
    }
    if (!user.isActive) {
      throw new UnauthorizedError("Your account has been deactivated. Contact an administrator.");
    }
    const { roleNames, permissionNames } = await rbacRepository.resolvePermissionNamesForUser(user._id);
    return { user, roles: roleNames, permissions: permissionNames };
  },
};
