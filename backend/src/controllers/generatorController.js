import { generatorRepository } from "../repositories/generatorRepository.js";
import { generatorService } from "../services/generatorService.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { NotFoundError, BadRequestError } from "../errors/AppError.js";

export const generatorController = {
  list: asyncHandler(async (req, res) => {
    const { status, location, search, page, pageSize } = req.query;
    const { items, ...meta } = await generatorRepository.list({
      status,
      location,
      search,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
    sendSuccess(res, { data: items, meta });
  }),

  getById: asyncHandler(async (req, res) => {
    const generator = await generatorRepository.findById(req.params.id);
    if (!generator || !generator.isActive) throw new NotFoundError("Generator not found");
    sendSuccess(res, { data: generator });
  }),

  create: asyncHandler(async (req, res) => {
    const generator = await generatorRepository.create({ ...req.body, createdBy: req.userId });
    sendSuccess(res, { statusCode: 201, message: "Generator created", data: generator });
  }),

  update: asyncHandler(async (req, res) => {
    const existing = await generatorRepository.findById(req.params.id);
    if (!existing || !existing.isActive) throw new NotFoundError("Generator not found");

    // Only re-check the gauge/capacity rule when the request actually touches
    // one of the two fields — editing an unrelated field on a legacy gauge
    // generator with no capacity yet must not suddenly start failing.
    if (req.body.fuelMeasurementType !== undefined || req.body.fuelTankCapacityLiters !== undefined) {
      const effectiveType = req.body.fuelMeasurementType ?? existing.fuelMeasurementType;
      const effectiveCapacity = req.body.fuelTankCapacityLiters ?? existing.fuelTankCapacityLiters;
      if (effectiveType === "gauge" && !(Number(effectiveCapacity) > 0)) {
        throw new BadRequestError("fuelTankCapacityLiters is required and must be greater than 0 when fuelMeasurementType is gauge");
      }
    }

    const generator = await generatorRepository.updateById(req.params.id, {
      ...req.body,
      updatedBy: req.userId,
    });
    sendSuccess(res, { message: "Generator updated", data: generator });
  }),

  remove: asyncHandler(async (req, res) => {
    const { deleted } = await generatorService.removeGenerator(req.params.id);
    sendSuccess(res, { message: "Generator deleted", data: { deleted } });
  }),
};
