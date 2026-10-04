import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // Assigned by the admin when creating a staff login (not auto-generated). Uppercased so
    // "emp-001" and "EMP-001" collide as the same id. `sparse` lets existing accounts and the
    // seeded admin, which have no employeeId, keep passing the unique index.
    employeeId: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true,
    },
    passwordHash: { type: String, required: true, select: false },
    phone: { type: String, trim: true },
    department: { type: String, trim: true },
    // Sets the length of this person's working day (Designation.shiftHours). Optional:
    // without one, attendance falls back to the default shift (env.overtimeThresholdMinutes).
    designation: { type: mongoose.Schema.Types.ObjectId, ref: "Designation" },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    // Calendar days per year, set by an admin (individually or via "assign to all").
    // Only the types that are actually limited; unpaid leave has no allocation and no cap.
    leaveAllocation: {
      casual: { type: Number, default: 0, min: 0 },
      sick: { type: Number, default: 0, min: 0 },
      annual: { type: Number, default: 0, min: 0 },
    },
  },
  { timestamps: true }
);

// Never expose passwordHash even if a query forgets to .select("-passwordHash").
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

export default mongoose.model("User", userSchema);
