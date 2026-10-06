import { User } from "../models/index.js";
import { normalizePhone } from "../utils/phone.js";

// What staff lists and the attendance service need to know about a designation.
export const DESIGNATION_FIELDS = "name shiftHours isActive";

export const userRepository = {
  // The lookups below return null for an empty value instead of matching "no email/phone".
  findByEmail: (email, withPassword = false) => {
    if (!email) return Promise.resolve(null);
    const query = User.findOne({ email: String(email).trim().toLowerCase() });
    return withPassword ? query.select("+passwordHash") : query;
  },
  findByEmployeeId: (employeeId, withPassword = false) => {
    if (!employeeId) return Promise.resolve(null);
    const query = User.findOne({ employeeId: String(employeeId).trim().toUpperCase() });
    return withPassword ? query.select("+passwordHash") : query;
  },
  findByPhone: (phone, withPassword = false) => {
    const normalized = normalizePhone(phone);
    if (!normalized) return Promise.resolve(null);
    const query = User.findOne({ phone: normalized });
    return withPassword ? query.select("+passwordHash") : query;
  },
  // One login field for everyone: anything with "@" is an email; otherwise an
  // Employee ID, then a phone number (Employee IDs are letters/digits/hyphens and
  // admin-assigned, so they're tried first).
  findByIdentifier: async (identifier, withPassword = false) => {
    const value = String(identifier ?? "").trim();
    if (!value) return null;
    if (value.includes("@")) return userRepository.findByEmail(value, withPassword);
    return (
      (await userRepository.findByEmployeeId(value, withPassword)) ||
      (await userRepository.findByPhone(value, withPassword))
    );
  },
  findById: (id) => User.findById(id),
  findByIdWithDesignation: (id) => User.findById(id).populate("designation", DESIGNATION_FIELDS),
  listAll: () =>
    User.find()
      .select("name email employeeId department designation isActive")
      .populate("designation", DESIGNATION_FIELDS)
      .sort({ name: 1 }),
  create: (data) => User.create(data),
  updateById: (id, data) =>
    User.findByIdAndUpdate(id, data, { returnDocument: "after" }).populate("designation", DESIGNATION_FIELDS),
  touchLastLogin: (id) => User.findByIdAndUpdate(id, { lastLoginAt: new Date() }),
  // People a monthly attendance summary covers: everyone in `ids` (they had activity
  // that month) plus every active staff member with a designation, optionally only
  // one designation. With `userId`, just that person.
  findForSummary: ({ ids = [], userId, designationId }) => {
    const query = userId
      ? { _id: userId }
      : { $or: [{ _id: { $in: ids } }, { isActive: true, designation: { $exists: true, $ne: null } }] };
    if (designationId) query.designation = designationId;
    return User.find(query)
      .select("name employeeId department designation isActive")
      .populate("designation", DESIGNATION_FIELDS)
      .sort({ name: 1 });
  },
  updateManyLeaveAllocation: (filter, allocation) => User.updateMany(filter, { $set: allocation }),

  // Paginated, searchable staff directory for the admin's Staff page.
  // `isActive` left undefined returns both active and deactivated accounts.
  list: async ({ search, isActive, page = 1, pageSize = 20 } = {}) => {
    const query = {};
    if (typeof isActive === "boolean") query.isActive = isActive;
    if (search) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(escaped, "i");
      query.$or = [{ name: pattern }, { email: pattern }, { employeeId: pattern }, { phone: pattern }];
      // A phone typed with spaces or +92 still finds the stored (normalized) number.
      const phone = normalizePhone(search);
      if (phone && /^\+?\d{3,}$/.test(phone)) {
        query.$or.push({ phone: new RegExp(phone.replace(/\+/g, "\\+")) });
      }
    }

    const [items, totalItems] = await Promise.all([
      User.find(query)
        .populate("designation", DESIGNATION_FIELDS)
        .sort({ name: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize),
      User.countDocuments(query),
    ]);
    return { items, totalItems };
  },
};
