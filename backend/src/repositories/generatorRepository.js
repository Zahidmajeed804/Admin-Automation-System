import { Generator } from "../models/index.js";

export const generatorRepository = {
  create: (data) => Generator.create(data),
  findById: (id) => Generator.findById(id),

  // page/pageSize/totalItems/totalPages match the shared Pagination
  // component's prop names exactly, so the controller can pass this
  // object straight through as sendSuccess's `meta`.
  list: async ({ status, location, search, page = 1, pageSize = 20 } = {}) => {
    const filter = { isActive: true };
    if (status) filter.status = status;
    if (location) filter.location = location;
    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [{ name: regex }, { tag: regex }];
    }

    const skip = (page - 1) * pageSize;
    const [items, totalItems] = await Promise.all([
      Generator.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
      Generator.countDocuments(filter),
    ]);

    return {
      items,
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize) || 0,
    };
  },

  updateById: (id, data) => Generator.findByIdAndUpdate(id, data, { new: true }),
  softDeleteById: (id) => Generator.findByIdAndUpdate(id, { isActive: false }, { new: true }),

  // $max only writes when the new date is later than the stored one (or none
  // is stored), so completing an OLD job late can never move lastServiceDate
  // backwards.
  recordServiceDate: (id, date) =>
    Generator.findByIdAndUpdate(id, { $max: { lastServiceDate: date } }, { returnDocument: "after" }),

  // Single-document $inc is atomic in MongoDB, so concurrent log entries
  // can't lose updates the way a read-modify-write would. Pass a negative
  // number to subtract.
  incrementRunningHours: (id, hours) =>
    Generator.findByIdAndUpdate(id, { $inc: { runningHoursTotal: hours } }, { new: true }),
};
