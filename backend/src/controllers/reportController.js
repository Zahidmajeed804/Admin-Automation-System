import { reportService } from "../services/reportService.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const reportController = {
  runningHours: asyncHandler(async (req, res) => {
    const report = await reportService.getRunningHoursReport({ generatorId: req.query.generatorId, month: req.query.month });
    sendSuccess(res, { data: report });
  }),

  dieselConsumption: asyncHandler(async (req, res) => {
    const { generatorId, from, to } = req.query;
    const report = await reportService.getDieselConsumptionReport({ generatorId, from, to });
    sendSuccess(res, { data: report });
  }),

  fuelCost: asyncHandler(async (req, res) => {
    const report = await reportService.getFuelCostReport({ generatorId: req.query.generatorId, month: req.query.month });
    sendSuccess(res, { data: report });
  }),

  maintenanceCost: asyncHandler(async (req, res) => {
    const { generatorId, from, to } = req.query;
    const report = await reportService.getMaintenanceCostReport({ generatorId, from, to });
    sendSuccess(res, { data: report });
  }),

  operatingCost: asyncHandler(async (req, res) => {
    const report = await reportService.getOperatingCostReport({ generatorId: req.query.generatorId, year: req.query.year });
    sendSuccess(res, { data: report });
  }),

  serviceHistory: asyncHandler(async (req, res) => {
    const { generatorId, status, from, to, page, pageSize } = req.query;
    const { items, ...meta } = await reportService.getServiceHistoryReport({
      generatorId,
      status,
      from,
      to,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
    sendSuccess(res, { data: items, meta });
  }),

  costSummary: asyncHandler(async (req, res) => {
    const { generatorId, from, to } = req.query;
    const report = await reportService.getCostSummaryReport({ generatorId, from, to });
    sendSuccess(res, { data: report });
  }),
};
