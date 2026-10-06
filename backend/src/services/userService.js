import { userRepository, DESIGNATION_FIELDS } from "../repositories/userRepository.js";
import { rbacRepository } from "../repositories/rbacRepository.js";
import { designationRepository } from "../repositories/designationRepository.js";
import { hashPassword } from "../utils/password.js";
import { normalizePhone } from "../utils/phone.js";
import { BadRequestError, ConflictError, NotFoundError } from "../errors/AppError.js";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// A designation picked for someone must exist and be active. Keeping a person on a
// designation that was deactivated later is fine, so callers skip this when unchanged.
async function assertAssignableDesignation(designationId) {
  const designation = await designationRepository.findById(designationId);
  if (!designation) {
    throw new NotFoundError("Designation not found");
  }
  if (!designation.isActive) {
    throw new BadRequestError("This designation is inactive and can't be assigned");
  }
}

// Throws 409 naming the field if another account already uses this email, phone or
// Employee ID. Empty values are skipped (they're optional), and so is `exceptId`, the
// account being edited. Shared with self-registration (authService.register).
export async function assertContactsAvailable({ email, phone, employeeId }, exceptId) {
  const [byEmail, byPhone, byEmployeeId] = await Promise.all([
    userRepository.findByEmail(email),
    userRepository.findByPhone(phone),
    userRepository.findByEmployeeId(employeeId),
  ]);
  const taken = (user) => user && String(user._id) !== String(exceptId);
  if (taken(byPhone)) throw new ConflictError("An account with this phone number already exists");
  if (taken(byEmail)) throw new ConflictError("An account with this email already exists");
  if (taken(byEmployeeId)) throw new ConflictError("An account with this Employee ID already exists");
}

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
  // Email is optional (AAS-468); phone and Employee ID are required by the validator.
  async create({ name, email, employeeId, password, phone, department, designationId, leaveAllocation }) {
    await assertContactsAvailable({ email, phone, employeeId });
    if (designationId) {
      await assertAssignableDesignation(designationId);
    }

    const passwordHash = await hashPassword(password);
    const user = await userRepository.create({
      name,
      email,
      employeeId,
      passwordHash,
      phone,
      department,
      designation: designationId || undefined,
      leaveAllocation,
    });
    await user.populate("designation", DESIGNATION_FIELDS);

    const staffRole = await rbacRepository.findRoleByName("staff");
    if (staffRole) {
      await rbacRepository.assignRoleToUser(user._id, staffRole._id);
    }

    return user;
  },

  // `designationId: null` (or "") removes the designation; undefined leaves it alone.
  // Same for email and phone: "" removes it.
  async update(id, { name, email, employeeId, phone, department, designationId, leaveAllocation }) {
    const existing = await userRepository.findById(id);
    if (!existing) {
      throw new NotFoundError("Staff member not found");
    }

    await assertContactsAvailable({ email, phone, employeeId }, id);
    if (designationId && String(designationId) !== String(existing.designation)) {
      await assertAssignableDesignation(designationId);
    }

    const changes = {};
    const unset = {};
    if (name !== undefined) changes.name = name;
    if (email) changes.email = email;
    else if (email !== undefined) unset.email = 1;
    if (employeeId !== undefined) changes.employeeId = employeeId;
    if (phone) changes.phone = normalizePhone(phone);
    else if (phone !== undefined) unset.phone = 1;
    if (department !== undefined) changes.department = department;
    if (designationId) changes.designation = designationId;
    else if (designationId !== undefined) unset.designation = 1;
    if (Object.keys(unset).length) changes.$unset = unset;
    // Dot-path keys so an update to one leave type merges instead of replacing
    // the whole subdocument (and resetting the other two types to 0).
    if (leaveAllocation?.casual !== undefined) changes["leaveAllocation.casual"] = leaveAllocation.casual;
    if (leaveAllocation?.sick !== undefined) changes["leaveAllocation.sick"] = leaveAllocation.sick;
    if (leaveAllocation?.annual !== undefined) changes["leaveAllocation.annual"] = leaveAllocation.annual;

    const updated = await userRepository.updateById(id, changes);
    if (!updated) {
      throw new NotFoundError("Staff member not found");
    }
    return updated;
  },

  // Bulk-sets the yearly leave allocation on every active account in one write, or
  // only on active staff holding `designationId` when one is given. Deactivated
  // designations are allowed here: the people who still hold one need leave too.
  // `overwrite: false` (the default) only fills accounts that look unset — all
  // three types at 0 or missing, since there's no separate "unset" sentinel on a
  // Number field. An admin who deliberately gave someone 0 days can always
  // re-apply it individually afterward.
  async assignLeaveAllocationToAll({ casual, sick, annual, overwrite = false, designationId }) {
    const filter = { isActive: true };
    if (designationId) {
      if (!(await designationRepository.findById(designationId))) {
        throw new NotFoundError("Designation not found");
      }
      filter.designation = designationId;
    }
    if (!overwrite) {
      // Accounts created before this field existed have no leaveAllocation at all —
      // Mongoose only backfills the schema default when a document is READ, not in
      // a raw query filter, so { casual: 0 } alone would silently skip them. $not:
      // { $gt: 0 } matches 0, null and "field absent" alike, and only those.
      const unset = { $not: { $gt: 0 } };
      filter["leaveAllocation.casual"] = unset;
      filter["leaveAllocation.sick"] = unset;
      filter["leaveAllocation.annual"] = unset;
    }

    const result = await userRepository.updateManyLeaveAllocation(filter, {
      "leaveAllocation.casual": casual,
      "leaveAllocation.sick": sick,
      "leaveAllocation.annual": annual,
    });
    return { matched: result.matchedCount, modified: result.modifiedCount };
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
