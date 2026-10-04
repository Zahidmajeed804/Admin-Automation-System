import { Designation } from "../models/index.js";
import { DESIGNATION_NAME_COLLATION } from "../models/Designation.js";

export const designationRepository = {
  findById: (id) => Designation.findById(id),
  // Same collation as the unique index, so the lookup matches what the index would reject.
  findByName: (name) => Designation.findOne({ name: name.trim() }).collation(DESIGNATION_NAME_COLLATION),
  // `isActive` left undefined returns both active and inactive designations.
  list: ({ isActive } = {}) => {
    const query = {};
    if (typeof isActive === "boolean") query.isActive = isActive;
    return Designation.find(query).collation(DESIGNATION_NAME_COLLATION).sort({ name: 1 });
  },
  create: (data) => Designation.create(data),
  updateById: (id, data) =>
    Designation.findByIdAndUpdate(id, data, { returnDocument: "after", runValidators: true }),
};
