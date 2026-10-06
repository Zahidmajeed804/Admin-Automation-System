import { GiveawayItem, GiveawayInventoryTransaction, GiveawayIssue } from "../models/index.js";

export const giveawayRepository = {
  // Items
  findItems: async ({ search, category, status, page = 1, limit = 10 }) => {
    const query = {};
    if (search) {
      query.$or = [
        { itemName: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
      ];
    }
    if (category) query.category = category;
    if (status === "lowStock") query.$expr = { $and: [{ $lte: ["$currentStock", "$minimumStock"] }, { $gt: ["$currentStock", 0] }] };
    if (status === "outOfStock") query.currentStock = { $lte: 0 };
    if (status === "active") query.isActive = true;
    if (status === "inactive") query.isActive = false;

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      GiveawayItem.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      GiveawayItem.countDocuments(query),
    ]);
    return { items, total };
  },
  findItemById: (id) => GiveawayItem.findById(id),
  findItemBySku: (sku) => GiveawayItem.findOne({ sku: sku.toUpperCase() }),
  createItem: (data) => GiveawayItem.create({ ...data, currentStock: data.openingStock }),
  updateItem: (id, data) => GiveawayItem.findByIdAndUpdate(id, data, { new: true, runValidators: true }),
  softDeleteItem: (id) => GiveawayItem.findByIdAndUpdate(id, { isActive: false }, { new: true }),
  hardDeleteItem: (id) => GiveawayItem.findByIdAndDelete(id),

  incrementStock: (id, amount) =>
    GiveawayItem.findByIdAndUpdate(id, { $inc: { currentStock: amount } }, { new: true }),

  countAll: () => GiveawayItem.countDocuments(),
  countLowStock: () =>
    GiveawayItem.countDocuments({
      isActive: true,
      $expr: { $and: [{ $lte: ["$currentStock", "$minimumStock"] }, { $gt: ["$currentStock", 0] }] },
    }),
  sumInventoryValue: async () => {
    const result = await GiveawayItem.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, total: { $sum: { $multiply: ["$unitPrice", "$currentStock"] } } } },
    ]);
    return result[0]?.total || 0;
  },

  // Transactions (ledger)
  createTransaction: (data) => GiveawayInventoryTransaction.create(data),
  findTransactionsByItem: (itemId) =>
    GiveawayInventoryTransaction.find({ item: itemId }).sort({ createdAt: -1 }),

  // Issues
  createIssue: (data) => GiveawayIssue.create(data),
  findIssues: async ({ page = 1, limit = 10, itemId, department } = {}) => {
    const query = {};
    if (itemId) query.item = itemId;
    if (department) query.department = department;
    const skip = (page - 1) * limit;
    const [issues, total] = await Promise.all([
      GiveawayIssue.find(query).populate("item", "itemName sku").sort({ date: -1 }).skip(skip).limit(limit),
      GiveawayIssue.countDocuments(query),
    ]);
    return { issues, total };
  },
  sumIssuedQuantityThisMonth: async () => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const result = await GiveawayIssue.aggregate([
      { $match: { date: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: "$quantity" } } },
    ]);
    return result[0]?.total || 0;
  },
};
