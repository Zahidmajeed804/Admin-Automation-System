import { designationRepository } from "../repositories/designationRepository.js";
import { ConflictError, NotFoundError } from "../errors/AppError.js";

export const designationService = {
  // `status` is "active", "inactive", or omitted for everyone.
  async list({ status } = {}) {
    const isActive = status === "active" ? true : status === "inactive" ? false : undefined;
    return designationRepository.list({ isActive });
  },

  async create({ name, shiftHours }) {
    if (await designationRepository.findByName(name)) {
      throw new ConflictError("A designation with this name already exists");
    }
    return designationRepository.create({ name, shiftHours });
  },

  async update(id, { name, shiftHours, isActive }) {
    const existing = await designationRepository.findById(id);
    if (!existing) {
      throw new NotFoundError("Designation not found");
    }

    if (name !== undefined) {
      const clash = await designationRepository.findByName(name);
      if (clash && String(clash._id) !== String(id)) {
        throw new ConflictError("A designation with this name already exists");
      }
    }

    const changes = {};
    if (name !== undefined) changes.name = name;
    if (shiftHours !== undefined) changes.shiftHours = shiftHours;
    if (isActive !== undefined) changes.isActive = isActive;

    const updated = await designationRepository.updateById(id, changes);
    if (!updated) {
      throw new NotFoundError("Designation not found");
    }
    return updated;
  },
};
