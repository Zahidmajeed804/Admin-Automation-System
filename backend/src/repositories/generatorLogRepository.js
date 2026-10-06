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

  // `update` is a Mongo update document ({ $set, $unset }). Returns the document
  // as it is after the change, or null if it no longer exists.
  updateById: (id, update) => GeneratorLog.findByIdAndUpdate(id, update, { returnDocument: "after", runValidators: true }),

  // Returns the deleted document (or null) so the caller can reverse any
  // side effects, e.g. subtracting its hoursRun from the generator's total.
  deleteById: (id) => GeneratorLog.findByIdAndDelete(id),

  // Removes every log of one generator; resolves { deletedCount }.
  deleteByGenerator: (generatorId) => GeneratorLog.deleteMany({ generator: generatorId }),
};
