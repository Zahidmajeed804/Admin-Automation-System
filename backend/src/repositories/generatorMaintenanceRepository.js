import { GeneratorMaintenance } from "../models/index.js";

export const generatorMaintenanceRepository = {
  create: (data) => GeneratorMaintenance.create(data),
  findById: (id) => GeneratorMaintenance.findById(id),

  // Same return shape as the other list() methods (page/pageSize/totalItems/
  // totalPages) so the controller can pass it straight through as `meta`.
  // Open work ("scheduled") lists soonest-due first; every other view
  // (completed / cancelled / all) lists most recent first.
  list: async ({ generatorId, status, page = 1, pageSize = 20 } = {}) => {
    const filter = {};
    if (generatorId) filter.generator = generatorId;
    if (status) filter.status = status;

    const dir = status === "scheduled" ? 1 : -1;
    const skip = (page - 1) * pageSize;
    const [items, totalItems] = await Promise.all([
      GeneratorMaintenance.find(filter)
        .sort({ scheduledDate: dir, createdAt: dir })
        .skip(skip)
        .limit(pageSize)
        .populate("generator", "tag name"),
      GeneratorMaintenance.countDocuments(filter),
    ]);

    return {
      items,
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize) || 0,
    };
  },

  // runValidators: findByIdAndUpdate skips schema validation by default, so
  // without it an update could store e.g. status "overdue" or a negative cost.
  updateById: (id, data) =>
    GeneratorMaintenance.findByIdAndUpdate(id, data, { new: true, runValidators: true }),

  // Every not-yet-done job across all generators (the alerts feed). Open work
  // is a small, bounded set, so this is not paginated. `isActive` is selected
  // so callers can skip jobs belonging to soft-deleted generators.
  listOpen: () =>
    GeneratorMaintenance.find({ status: "scheduled" })
      .sort({ scheduledDate: 1, createdAt: 1 })
      .populate("generator", "tag name isActive"),

  // Atomic "update it only if it's still scheduled". The status is part of
  // the filter, so if two requests race — two completions, or a cancel against
  // a completion — exactly one matches and the other gets null. That is what
  // stops a double-click creating the next recurring occurrence twice, and
  // stops a cancel overwriting a job that was just completed.
  updateIfScheduled: (id, data) =>
    GeneratorMaintenance.findOneAndUpdate({ _id: id, status: "scheduled" }, data, {
      returnDocument: "after",
      runValidators: true,
    }),

  // Returns the deleted document (or null).
  deleteById: (id) => GeneratorMaintenance.findByIdAndDelete(id),
};
