import mongoose from "mongoose";

const giveawayItemSchema = new mongoose.Schema(
  {
    itemName: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true, trim: true, uppercase: true },
    category: { type: String, required: true, trim: true },
    unitPrice: { type: Number, required: true, min: 0 },
    vendor: { type: String, trim: true },
    openingStock: { type: Number, required: true, min: 0, default: 0 },
    // currentStock is maintained by giveawayService as stock-in/out/issue
    // transactions are recorded — never edited directly by a form.
    currentStock: { type: Number, required: true, min: 0, default: 0 },
    minimumStock: { type: Number, required: true, min: 0, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

giveawayItemSchema.index({ itemName: "text", sku: "text" });

giveawayItemSchema.virtual("status").get(function () {
  if (!this.isActive) return "inactive";
  if (this.currentStock <= 0) return "outOfStock";
  if (this.currentStock <= this.minimumStock) return "lowStock";
  return "inStock";
});

giveawayItemSchema.set("toJSON", { virtuals: true });
giveawayItemSchema.set("toObject", { virtuals: true });

export default mongoose.model("GiveawayItem", giveawayItemSchema);
