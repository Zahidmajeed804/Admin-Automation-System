import mongoose from "mongoose";

// A job title the admin manages (e.g. "Office Boy", "Engineer"). Its shiftHours is
// how long a working day is for everyone holding it: overtime starts and early
// departure is measured against it (see attendanceService).
const designationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    shiftHours: { type: Number, required: true, min: 1, max: 16 },
    // Deactivate instead of delete, so staff who still hold it keep a valid reference.
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Case-insensitive unique: "engineer" and "Engineer" are the same designation.
export const DESIGNATION_NAME_COLLATION = { locale: "en", strength: 2 };
designationSchema.index({ name: 1 }, { unique: true, collation: DESIGNATION_NAME_COLLATION });

export default mongoose.model("Designation", designationSchema);
