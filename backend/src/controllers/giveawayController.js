import { giveawayService } from "../services/giveawayService.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const giveawayController = {
  listItems: asyncHandler(async (req, res) => {
    const { search, category, status, page, limit } = req.query;
    const result = await giveawayService.listItems({
      search,
      category,
      status,
      page: Number(page) || 1,
      limit: Number(limit) || 10,
    });
    sendSuccess(res, {
      data: result.items,
      meta: { total: result.total, page: result.page, totalPages: result.totalPages },
    });
  }),

  getItem: asyncHandler(async (req, res) => {
    const item = await giveawayService.getItem(req.params.id);
    sendSuccess(res, { data: item });
  }),

  createItem: asyncHandler(async (req, res) => {
    const item = await giveawayService.createItem(req.body);
    sendSuccess(res, { statusCode: 201, message: "Giveaway item created", data: item });
  }),

  updateItem: asyncHandler(async (req, res) => {
    const item = await giveawayService.updateItem(req.params.id, req.body);
    sendSuccess(res, { message: "Giveaway item updated", data: item });
  }),

  deactivateItem: asyncHandler(async (req, res) => {
    await giveawayService.deactivateItem(req.params.id);
    sendSuccess(res, { message: "Giveaway item deactivated" });
  }),

  stockIn: asyncHandler(async (req, res) => {
    const item = await giveawayService.stockIn(req.params.id, req.body, req.userId);
    sendSuccess(res, { message: "Stock added", data: item });
  }),

  stockOut: asyncHandler(async (req, res) => {
    const item = await giveawayService.stockOut(req.params.id, req.body, req.userId);
    sendSuccess(res, { message: "Stock removed", data: item });
  }),

  issueItem: asyncHandler(async (req, res) => {
    const issue = await giveawayService.issueItem(req.body, req.userId);
    sendSuccess(res, { statusCode: 201, message: "Giveaway issued", data: issue });
  }),

  listIssues: asyncHandler(async (req, res) => {
    const { page, limit, itemId, department } = req.query;
    const result = await giveawayService.listIssues({
      page: Number(page) || 1,
      limit: Number(limit) || 10,
      itemId,
      department,
    });
    sendSuccess(res, {
      data: result.issues,
      meta: { total: result.total, page: result.page, totalPages: result.totalPages },
    });
  }),

  dashboard: asyncHandler(async (req, res) => {
    const summary = await giveawayService.getDashboardSummary();
    sendSuccess(res, { data: summary });
  }),
};
