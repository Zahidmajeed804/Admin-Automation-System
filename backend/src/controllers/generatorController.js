import { generatorRepository } from "../repositories/generatorRepository.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { NotFoundError } from "../errors/AppError.js";

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
    const generator = await generatorRepository.updateById(req.params.id, {
      ...req.body,
      updatedBy: req.userId,
    });
    sendSuccess(res, { message: "Generator updated", data: generator });
  }),

  remove: asyncHandler(async (req, res) => {
    const existing = await generatorRepository.findById(req.params.id);
    if (!existing || !existing.isActive) throw new NotFoundError("Generator not found");
    await generatorRepository.softDeleteById(req.params.id);
    sendSuccess(res, { message: "Generator deleted" });
  }),
};
