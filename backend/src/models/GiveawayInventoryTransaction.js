import mongoose from "mongoose";

const giveawayInventoryTransactionSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: "GiveawayItem", required: true, index: true },
    type: { type: String, enum: ["stock-in", "stock-out", "issue"], required: true },
    quantity: { type: Number, required: true, min: 1 },
    balanceAfter: { type: Number, required: true },
    reference: { type: String, trim: true }, // e.g. issue id, purchase note
    remarks: { type: String, trim: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("GiveawayInventoryTransaction", giveawayInventoryTransactionSchema);
