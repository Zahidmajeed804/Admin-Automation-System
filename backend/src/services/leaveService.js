import { leaveRepository } from "../repositories/leaveRepository.js";
import { LEAVE_TYPES } from "../models/LeaveRequest.js";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../errors/AppError.js";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// The decision a reviewer sends maps 1:1 onto the request's status.
const REVIEW_DECISIONS = ["approved", "rejected"];

const startOfDay = (date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

export const leaveService = {
  // Reviewers (canViewAll, i.e. leave.approve) may see everyone or filter by userId;
  // everyone else is always scoped to their own requests.
  async list({ requesterId, canViewAll = false, userId, status, leaveType, startDate, endDate, page, pageSize }) {
    const scopedUserId = canViewAll ? userId : requesterId;
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safePageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(pageSize, 10) || DEFAULT_PAGE_SIZE));

    const { items, totalItems } = await leaveRepository.list({
      userId: scopedUserId,
      status,
      leaveType,
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

  // A user can't hold two live (pending/approved) requests over the same days;
  // a rejected request frees its days again.
  async create(userId, { leaveType, startDate, endDate, reason }) {
    if (!LEAVE_TYPES.includes(leaveType)) {
      throw new BadRequestError(`leaveType must be one of: ${LEAVE_TYPES.join(", ")}`);
    }

    const start = startOfDay(startDate);
    const end = startOfDay(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestError("startDate and endDate must be valid dates");
    }
    if (end < start) {
      throw new BadRequestError("endDate must not be before startDate");
    }

    const clash = await leaveRepository.findOverlapping(userId, start, end);
    if (clash) {
      const article = clash.status === "approved" ? "an" : "a";
      throw new ConflictError(`You already have ${article} ${clash.status} leave request overlapping these dates`);
    }

    return leaveRepository.create({
      user: userId,
      leaveType,
      startDate: start,
      endDate: end,
      totalDays: Math.round((end - start) / MS_PER_DAY) + 1,
      reason,
    });
  },

  // Approve or reject a pending request. A request is decided once; nobody reviews their own.
  async review(id, { reviewerId, decision, note }) {
    if (!REVIEW_DECISIONS.includes(decision)) {
      throw new BadRequestError(`decision must be one of: ${REVIEW_DECISIONS.join(", ")}`);
    }

    const request = await leaveRepository.findById(id);
    if (!request) {
      throw new NotFoundError("Leave request not found");
    }
    if (String(request.user) === String(reviewerId)) {
      throw new ForbiddenError("You cannot review your own leave request");
    }

    const reviewed = await leaveRepository.reviewIfPending(id, {
      status: decision,
      reviewedBy: reviewerId,
      reviewNote: note,
    });
    if (!reviewed) {
      // Lost the race, or it was already decided before we got here.
      throw new ConflictError(`Leave request is already ${request.status === "pending" ? "reviewed" : request.status}`);
    }
    return reviewed;
  },
};
