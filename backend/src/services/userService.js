import { userRepository } from "../repositories/userRepository.js";
import { rbacRepository } from "../repositories/rbacRepository.js";
import { hashPassword } from "../utils/password.js";
import { BadRequestError, ConflictError, NotFoundError } from "../errors/AppError.js";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export const userService = {
  // `status` is "active", "inactive", or omitted for everyone.
  async list({ search, status, page, pageSize }) {
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safePageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(pageSize, 10) || DEFAULT_PAGE_SIZE));
    const isActive = status === "active" ? true : status === "inactive" ? false : undefined;

    const { items, totalItems } = await userRepository.list({
      search,
      isActive,
      page: safePage,
      pageSize: safePageSize,
    });

    return {
      items,
      pagination: {
        page: safePage,
        pageSize: safePageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / safePageSize),
      },
    };
  },

  // Creates a staff login and assigns the default "staff" role, the same way
  // self-registration does (authService.register). The admin can change roles
  // afterwards via the roles API.
  async create({ name, email, employeeId, password, phone, department }) {
    const [existingEmail, existingEmployeeId] = await Promise.all([
      userRepository.findByEmail(email),
      userRepository.findByEmployeeId(employeeId),
    ]);
    if (existingEmail) {
      throw new ConflictError("An account with this email already exists");
    }
    if (existingEmployeeId) {
      throw new ConflictError("An account with this Employee ID already exists");
    }

    const passwordHash = await hashPassword(password);
    const user = await userRepository.create({ name, email, employeeId, passwordHash, phone, department });

    const staffRole = await rbacRepository.findRoleByName("staff");
    if (staffRole) {
      await rbacRepository.assignRoleToUser(user._id, staffRole._id);
    }

    return user;
  },

  async update(id, { name, email, employeeId, phone, department }) {
    const existing = await userRepository.findById(id);
    if (!existing) {
      throw new NotFoundError("Staff member not found");
    }

    if (email && email.toLowerCase() !== existing.email) {
      const clash = await userRepository.findByEmail(email);
      if (clash) throw new ConflictError("An account with this email already exists");
    }
    if (employeeId && employeeId.toUpperCase() !== existing.employeeId) {
      const clash = await userRepository.findByEmployeeId(employeeId);
      if (clash) throw new ConflictError("An account with this Employee ID already exists");
    }

    const changes = {};
    if (name !== undefined) changes.name = name;
    if (email !== undefined) changes.email = email;
    if (employeeId !== undefined) changes.employeeId = employeeId;
    if (phone !== undefined) changes.phone = phone;
    if (department !== undefined) changes.department = department;

    const updated = await userRepository.updateById(id, changes);
    if (!updated) {
      throw new NotFoundError("Staff member not found");
    }
    return updated;
  },

  // Deactivating blocks login and hides the account from pickers but keeps their
  // attendance/leave/overtime history intact. `authenticate` re-checks isActive on
  // every request, so an existing token stops working on its very next call.
  async setActive(id, isActive, requesterId) {
    if (String(id) === String(requesterId) && !isActive) {
      throw new BadRequestError("You cannot deactivate your own account");
    }

    const updated = await userRepository.updateById(id, { isActive });
    if (!updated) {
      throw new NotFoundError("Staff member not found");
    }
    return updated;
  },
};
