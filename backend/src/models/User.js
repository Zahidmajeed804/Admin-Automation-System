import mongoose from "mongoose";
import { normalizePhone } from "../utils/phone.js";

// "" means "no value": stored as absent so the partial unique indexes below skip it.
const emptyToUndefined = (v) => (v === "" || v === null ? undefined : v);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Optional (AAS-468): staff can sign in with a phone number or Employee ID instead.
    // Unique only among users who have one — see the partial index below.
    email: {
      type: String,
      lowercase: true,
      trim: true,
      set: emptyToUndefined,
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
    // Stored normalized (utils/phone.js), so "+92 300-1234567" and "03001234567" are the
    // same number for uniqueness and login. Unique among users who have one.
    phone: { type: String, trim: true, set: normalizePhone },
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

// Unique only where the field is a real string. A plain unique index would treat every
// missing value as null and allow just one user without an email (or phone); `sparse`
// still indexes explicit nulls. `npm run seed` replaces the old plain email index
// (seeders/migrations.js).
userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } });
userSchema.index({ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: "string" } } });

// Never expose passwordHash even if a query forgets to .select("-passwordHash").
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

export default mongoose.model("User", userSchema);
