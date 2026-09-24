import { overtimeRepository } from "../repositories/overtimeRepository.js";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../errors/AppError.js";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// The decision a reviewer sends maps 1:1 onto the request's status.
const REVIEW_DECISIONS = ["approved", "rejected"];

export const overtimeService = {
  // Reviewers (canViewAll, i.e. overtime.approve) may see everyone or filter by userId;
  // everyone else is always scoped to their own requests.
  async list({ requesterId, canViewAll = false, userId, status, startDate, endDate, page, pageSize }) {
    const scopedUserId = canViewAll ? userId : requesterId;
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safePageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(pageSize, 10) || DEFAULT_PAGE_SIZE));

    const { items, totalItems } = await overtimeRepository.list({
      userId: scopedUserId,
      status,
      startDate,
      endDate,
      page: safePage,
      pageSize: safePageSize,
    });

    return {
      items,
      pagination: {
        page: safePage,
        pageSize: safePageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / safePageSize),
      },
    };
  },

  // Approve or reject a pending request. A request is decided once; nobody reviews their own.
  async review(id, { reviewerId, decision, note }) {
    if (!REVIEW_DECISIONS.includes(decision)) {
      throw new BadRequestError(`decision must be one of: ${REVIEW_DECISIONS.join(", ")}`);
    }

    const request = await overtimeRepository.findById(id);
    if (!request) {
      throw new NotFoundError("Overtime request not found");
    }
    if (String(request.user) === String(reviewerId)) {
      throw new ForbiddenError("You cannot review your own overtime request");
    }

    const reviewed = await overtimeRepository.reviewIfPending(id, {
      status: decision,
      reviewedBy: reviewerId,
      reviewNote: note,
    });
    if (!reviewed) {
      // Lost the race, or it was already decided before we got here.
      throw new ConflictError(`Overtime request is already ${request.status === "pending" ? "reviewed" : request.status}`);
    }
    return reviewed;
  },
};
