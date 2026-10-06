import mongoose from "mongoose";

const giveawayIssueSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: "GiveawayItem", required: true, index: true },
    date: { type: Date, required: true, default: Date.now },
    employeeName: { type: String, required: true, trim: true },
    department: { type: String, trim: true },
    eventName: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    approvedBy: { type: String, trim: true },
    remarks: { type: String, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model("GiveawayIssue", giveawayIssueSchema);
