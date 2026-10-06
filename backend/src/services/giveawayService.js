import { giveawayRepository } from "../repositories/giveawayRepository.js";
import { NotFoundError, BadRequestError, ConflictError } from "../errors/AppError.js";

export const giveawayService = {
  async listItems(filters) {
    const { items, total } = await giveawayRepository.findItems(filters);
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 10;
    return { items, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) };
  },

  async getItem(id) {
    const item = await giveawayRepository.findItemById(id);
    if (!item) throw new NotFoundError("Giveaway item not found");
    return item;
  },

  async createItem(data) {
    const existing = await giveawayRepository.findItemBySku(data.sku);
    if (existing) throw new ConflictError("An item with this SKU already exists");
    return giveawayRepository.createItem(data);
  },

  async updateItem(id, data) {
    const item = await giveawayRepository.findItemById(id);
    if (!item) throw new NotFoundError("Giveaway item not found");
    // Stock fields are never edited directly through the update endpoint —
    // only through stock-in/stock-out/issue so the transaction ledger stays
    // the single source of truth for balance history.
    const { currentStock, openingStock, ...safeData } = data;
    return giveawayRepository.updateItem(id, safeData);
  },

  async deactivateItem(id) {
    const item = await giveawayRepository.findItemById(id);
    if (!item) throw new NotFoundError("Giveaway item not found");
    return giveawayRepository.softDeleteItem(id);
  },

  async stockIn(id, { quantity, remarks }, userId) {
    if (quantity <= 0) throw new BadRequestError("Quantity must be greater than zero");
    const item = await giveawayRepository.findItemById(id);
    if (!item) throw new NotFoundError("Giveaway item not found");

    const updated = await giveawayRepository.incrementStock(id, quantity);
    await giveawayRepository.createTransaction({
      item: id,
      type: "stock-in",
      quantity,
      balanceAfter: updated.currentStock,
      remarks,
      performedBy: userId,
    });
    return updated;
  },

  async stockOut(id, { quantity, remarks }, userId) {
    if (quantity <= 0) throw new BadRequestError("Quantity must be greater than zero");
    const item = await giveawayRepository.findItemById(id);
    if (!item) throw new NotFoundError("Giveaway item not found");
    if (item.currentStock < quantity) {
      throw new BadRequestError(`Insufficient stock. Current balance is ${item.currentStock}`);
    }

    const updated = await giveawayRepository.incrementStock(id, -quantity);
    await giveawayRepository.createTransaction({
      item: id,
      type: "stock-out",
      quantity,
      balanceAfter: updated.currentStock,
      remarks,
      performedBy: userId,
    });
    return updated;
  },

  async issueItem(data, userId) {
    const { itemId, quantity } = data;
    if (quantity <= 0) throw new BadRequestError("Quantity must be greater than zero");

    const item = await giveawayRepository.findItemById(itemId);
    if (!item) throw new NotFoundError("Giveaway item not found");
    if (item.currentStock < quantity) {
      throw new BadRequestError(`Insufficient stock. Current balance is ${item.currentStock}`);
    }

    const issue = await giveawayRepository.createIssue({
      item: itemId,
      date: data.date,
      employeeName: data.employeeName,
      department: data.department,
      eventName: data.eventName,
      quantity,
      approvedBy: data.approvedBy,
      remarks: data.remarks,
    });

    const updated = await giveawayRepository.incrementStock(itemId, -quantity);
    await giveawayRepository.createTransaction({
      item: itemId,
      type: "issue",
      quantity,
      balanceAfter: updated.currentStock,
      reference: issue._id.toString(),
      remarks: `Issued to ${data.employeeName}`,
      performedBy: userId,
    });

    return issue;
  },

  async listIssues(filters) {
    const { issues, total } = await giveawayRepository.findIssues(filters);
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 10;
    return { issues, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) };
  },

  async getDashboardSummary() {
    const [totalItems, lowStockCount, totalInventoryValue, monthlyIssuedQuantity] = await Promise.all([
      giveawayRepository.countAll(),
      giveawayRepository.countLowStock(),
      giveawayRepository.sumInventoryValue(),
      giveawayRepository.sumIssuedQuantityThisMonth(),
    ]);
    return { totalItems, lowStockCount, totalInventoryValue, monthlyIssuedQuantity };
  },
};
