import mongoose from "mongoose";

// Aggregation pipelines don't cast like find() does, so string ids in a $match
// must be turned into ObjectIds first.
export const toObjectIds = (ids) => ids.map((id) => new mongoose.Types.ObjectId(String(id)));
