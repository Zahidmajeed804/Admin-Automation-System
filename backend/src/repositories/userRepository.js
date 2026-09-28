import { User } from "../models/index.js";

export const userRepository = {
  findByEmail: (email, withPassword = false) => {
    const query = User.findOne({ email: email.toLowerCase() });
    return withPassword ? query.select("+passwordHash") : query;
  },
  findByEmployeeId: (employeeId) => User.findOne({ employeeId: employeeId.toUpperCase() }),
  findById: (id) => User.findById(id),
  listAll: () => User.find().select("name email employeeId department isActive").sort({ name: 1 }),
  create: (data) => User.create(data),
  updateById: (id, data) => User.findByIdAndUpdate(id, data, { returnDocument: "after" }),
  touchLastLogin: (id) => User.findByIdAndUpdate(id, { lastLoginAt: new Date() }),

  // Paginated, searchable staff directory for the admin's Staff page.
  // `isActive` left undefined returns both active and deactivated accounts.
  list: async ({ search, isActive, page = 1, pageSize = 20 } = {}) => {
    const query = {};
    if (typeof isActive === "boolean") query.isActive = isActive;
    if (search) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(escaped, "i");
      query.$or = [{ name: pattern }, { email: pattern }, { employeeId: pattern }];
    }

    const [items, totalItems] = await Promise.all([
      User.find(query)
        .sort({ name: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize),
      User.countDocuments(query),
    ]);
    return { items, totalItems };
  },
};
