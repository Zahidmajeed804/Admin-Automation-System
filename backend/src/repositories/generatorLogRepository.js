import { GeneratorLog } from "../models/index.js";

export const generatorLogRepository = {
  create: (data) => GeneratorLog.create(data),
  findById: (id) => GeneratorLog.findById(id),

  // Same return shape as generatorRepository.list (page/pageSize/totalItems/
  // totalPages) so the controller can pass it straight through as `meta`.
  // `from`/`to` are inclusive bounds on the log's `date`.
  list: async ({ generatorId, from, to, page = 1, pageSize = 20 } = {}) => {
    const filter = {};
    if (generatorId) filter.generator = generatorId;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }

    const skip = (page - 1) * pageSize;
    const [items, totalItems] = await Promise.all([
      GeneratorLog.find(filter)
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .populate("generator", "tag name")
        .populate("recordedBy", "name"),
      GeneratorLog.countDocuments(filter),
    ]);

    return {
      items,
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize) || 0,
    };
  },

  // Returns the deleted document (or null) so the caller can reverse any
  // side effects, e.g. subtracting its hoursRun from the generator's total.
  deleteById: (id) => GeneratorLog.findByIdAndDelete(id),
};
